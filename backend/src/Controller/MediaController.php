<?php

namespace App\Controller;

use App\Entity\Media;
use App\Service\Ids;
use App\Service\Input;
use Symfony\Component\HttpFoundation\File\UploadedFile;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

// Fichiers déposés (CSV/JSON des fournisseurs) et images de la médiathèque.
// Ils sont écrits dans UPLOAD_DIR et servis directement par le serveur web à l'adresse UPLOAD_URL.
#[Route('/api')]
class MediaController extends ApiController
{
    private const MAX_BYTES = 5 * 1024 * 1024;
    private const DATA_EXTENSIONS = ['csv', 'tsv', 'txt', 'json'];
    private const IMAGE_TYPES = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    public function __construct(private readonly string $uploadDir, private readonly string $uploadUrl)
    {
    }

    #[Route('/files', methods: ['POST'])]
    public function upload(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->manageDatasets($user) || $this->can->createArticle($user));
        $file = $request->files->get('file');
        if (!$file instanceof UploadedFile || !$file->isValid()) {
            Input::fail('Aucun fichier reçu (taille maximale : 5 Mo).');
        }
        if ($file->getSize() > self::MAX_BYTES) {
            Input::fail('Fichier trop volumineux (5 Mo au maximum).');
        }
        $original = $file->getClientOriginalName();
        $ext = strtolower(pathinfo($original, \PATHINFO_EXTENSION));
        if (!\in_array($ext, self::DATA_EXTENSIONS, true)) {
            Input::fail('Formats acceptés : CSV, TSV, TXT ou JSON.');
        }
        $base = Ids::slugify(pathinfo($original, \PATHINFO_FILENAME)) ?: 'donnees';
        $name = substr(Ids::make('f'), 2).'-'.substr($base, 0, 60).'.'.$ext;
        $size = $file->getSize();
        $file->move($this->dir('files'), $name);

        return $this->ok(['url' => $this->url('files/'.$name), 'name' => $original, 'size' => $size], 201);
    }

    #[Route('/media', methods: ['GET'])]
    public function list(): JsonResponse
    {
        $media = $this->em->getRepository(Media::class)->findBy([], ['createdAt' => 'DESC']);

        return $this->ok(array_map(fn (Media $m) => $this->out->media($m), $media));
    }

    // Image envoyée par l'éditeur sous forme de data URL (déjà redimensionnée par le navigateur).
    #[Route('/media', methods: ['POST'])]
    public function add(Request $request): JsonResponse
    {
        $user = $this->requireUser();
        $this->guard($this->can->createArticle($user) || $this->can->editTheme($user));
        $in = $this->body($request);
        $dataUrl = (string) ($in['dataUrl'] ?? '');
        if (!preg_match('#^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$#', $dataUrl, $m)) {
            Input::fail('Image invalide (JPEG, PNG, WebP ou GIF attendu).');
        }
        $bytes = base64_decode($m[2], true);
        if (false === $bytes || \strlen($bytes) > self::MAX_BYTES) {
            Input::fail('Image invalide ou trop volumineuse (5 Mo au maximum).');
        }
        $info = @getimagesizefromstring($bytes);
        if (!$info || !isset(self::IMAGE_TYPES[$info['mime']])) {
            Input::fail('Le fichier envoyé n’est pas une image lisible.');
        }
        $id = Ids::make('m');
        $file = $id.'.'.self::IMAGE_TYPES[$info['mime']];
        file_put_contents($this->dir('media').'/'.$file, $bytes);

        $name = trim((string) Input::string($in, 'name', 255, 'Nom')) ?: $file;
        $media = new Media($id, $name, $user);
        $media->url = $this->url('media/'.$file);
        $media->alt = (string) Input::string($in, 'alt', 255, 'Texte alternatif');
        $media->mimeType = $info['mime'];
        $media->width = min((int) $info[0], 32767);
        $media->height = min((int) $info[1], 32767);
        $this->em->persist($media);
        $this->em->flush();

        return $this->ok($this->out->media($media), 201);
    }

    private function dir(string $sub): string
    {
        $dir = rtrim($this->uploadDir, '/').'/'.$sub;
        if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
            throw new \RuntimeException("Impossible de créer $dir");
        }

        return $dir;
    }

    private function url(string $path): string
    {
        return rtrim($this->uploadUrl, '/').'/'.$path;
    }
}
