<?php

namespace App\EventSubscriber;

use Psr\Log\LoggerInterface;
use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpKernel\Event\ExceptionEvent;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\KernelEvents;

// Toutes les erreurs de l'API au format attendu par le front : { "message": "…" }.
class ApiExceptionSubscriber implements EventSubscriberInterface
{
    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    public static function getSubscribedEvents(): array
    {
        // Priorité basse : le pare-feu de Symfony traite d'abord ses propres exceptions.
        return [KernelEvents::EXCEPTION => ['onException', -64]];
    }

    public function onException(ExceptionEvent $event): void
    {
        if (!str_starts_with($event->getRequest()->getPathInfo(), '/api')) {
            return;
        }
        $e = $event->getThrowable();
        if ($e instanceof HttpExceptionInterface) {
            $status = $e->getStatusCode();
            $message = $e->getMessage() ?: 'Erreur '.$status;
            if (404 === $status && str_starts_with($message, 'No route found')) {
                $message = 'Route inconnue.';
            } elseif (405 === $status) {
                $message = 'Méthode non autorisée.';
            }
            $response = new JsonResponse(['message' => $message], $status, $e->getHeaders());
        } else {
            $this->logger->error($e->getMessage(), ['exception' => $e]);
            $response = new JsonResponse(['message' => 'Erreur interne du serveur.'], 500);
        }
        $event->setResponse($response);
    }
}
