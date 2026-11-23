<?php

namespace App\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Security\Http\Event\LogoutEvent;

// L'API répond 204 au lieu de rediriger après la déconnexion.
class LogoutSubscriber implements EventSubscriberInterface
{
    public static function getSubscribedEvents(): array
    {
        return [LogoutEvent::class => ['onLogout', -10]];
    }

    public function onLogout(LogoutEvent $event): void
    {
        $event->setResponse(new Response(null, Response::HTTP_NO_CONTENT));
    }
}
