import React, { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { ComptePlateforme, mesEvenements } from '../../services/plateforme';

import { ConnexionPlateforme } from './ConnexionPlateforme';
import { CreerEvenement } from './CreerEvenement';
import { MesEvenements } from './MesEvenements';
import { MesBillets } from './MesBillets';
import { MonCompte } from './MonCompte';
import { PageEvenement } from './PageEvenement';
import { TableauDeBord } from './TableauDeBord';
import { Vitrine } from './Vitrine';

/**
 * Aiguillage de la plateforme Tech Event.
 *
 * Ce que chacun voit depend de son statut, et non d'un menu qu'on lui
 * cacherait : la vitrine pour qui passe, ses evenements pour qui en organise.
 * Le serveur decide de ce que contient chaque reponse ; cet ecran ne fait que
 * choisir lequel afficher.
 *
 * L'adresse porte l'etat, pour que les pages d'evenement soient partageables
 * et que le bouton « precedent » du navigateur fasse ce qu'on attend. Un
 * routeur complet serait disproportionne pour quatre vues.
 */

interface PlateformeProps {
  /** Vrai quand une session est ouverte. */
  connecte: boolean;
  /** Ouvre l'ecran de connexion. */
  onConnexion: () => void;
}

type Vue =
  | { nom: 'vitrine' }
  | { nom: 'evenement'; slug: string }
  | { nom: 'mes-evenements' }
  | { nom: 'creation' }
  | { nom: 'plateforme' }
  | { nom: 'connexion' }
  | { nom: 'mon-compte' }
  | { nom: 'mes-billets'; slug: string };

/** Lit la vue depuis l'adresse. */
function vueDepuisAdresse(): Vue {
  const params = new URLSearchParams(window.location.search);

  const slug = params.get('evenement');
  const espace = params.get('espace');

  /*
   * L'evenement est lu avant l'espace, mais pas a sa place : les deux se
   * combinent pour « mes billets », qui porte sur un evenement precis. Sans
   * cela, un lien complet retombait sur la page publique de l'evenement.
   */
  if (slug) {
    return espace === 'mes-billets' ? { nom: 'mes-billets', slug } : { nom: 'evenement', slug };
  }

  if (espace === 'mes-evenements') return { nom: 'mes-evenements' };
  if (espace === 'creation') return { nom: 'creation' };
  if (espace === 'plateforme') return { nom: 'plateforme' };
  if (espace === 'connexion') return { nom: 'connexion' };
  if (espace === 'mon-compte') return { nom: 'mon-compte' };

  return { nom: 'vitrine' };
}

/** Ecrit la vue dans l'adresse, sans recharger la page. */
function poserAdresse(vue: Vue) {
  const params = new URLSearchParams(window.location.search);

  params.delete('evenement');
  params.delete('espace');

  if (vue.nom === 'evenement') params.set('evenement', vue.slug);

  // L'adresse porte l'evenement et l'intention : un lien « mes billets » envoye
  // par un organisateur ouvre donc directement le bon ecran.
  if (vue.nom === 'mes-billets') {
    params.set('evenement', vue.slug);
    params.set('espace', 'mes-billets');
  }
  if (vue.nom === 'mes-evenements') params.set('espace', 'mes-evenements');
  if (vue.nom === 'creation') params.set('espace', 'creation');
  if (vue.nom === 'plateforme') params.set('espace', 'plateforme');
  if (vue.nom === 'connexion') params.set('espace', 'connexion');
  if (vue.nom === 'mon-compte') params.set('espace', 'mon-compte');

  const suite = params.toString();
  window.history.pushState({}, '', suite ? `?${suite}` : window.location.pathname);
}

export const Plateforme: React.FC<PlateformeProps> = ({ connecte, onConnexion }) => {
  const [vue, setVue] = useState<Vue>(vueDepuisAdresse);
  const [monCompte, setMonCompte] = useState<ComptePlateforme | null>(null);

  /** Relit le compte courant — après un changement de mot de passe, par exemple. */
  const relireCompte = useCallback(() => {
    if (!connecte) {
      setMonCompte(null);
      return;
    }

    mesEvenements()
      .then(r => setMonCompte(r.account))
      .catch(() => setMonCompte(null));
  }, [connecte]);

  useEffect(relireCompte, [relireCompte]);

  const aller = useCallback((suivante: Vue) => {
    poserAdresse(suivante);
    setVue(suivante);
  }, []);

  // Le bouton « précédent » du navigateur doit ramener à la vue d'avant, et
  // non quitter l'application.
  useEffect(() => {
    const surRetour = () => setVue(vueDepuisAdresse());
    window.addEventListener('popstate', surRetour);
    return () => window.removeEventListener('popstate', surRetour);
  }, []);

  /*
   * Les vues d'organisateur demandent une session. Quelqu'un qui arrive sur
   * l'une d'elles par un lien sans etre connecte est renvoye a la vitrine
   * plutot que devant un ecran vide : le serveur refuserait de toute facon, et
   * un refus n'explique rien a qui n'a rien demande.
   */
  useEffect(() => {
    const reservee =
      vue.nom === 'mes-evenements' ||
      vue.nom === 'creation' ||
      vue.nom === 'plateforme' ||
      vue.nom === 'mon-compte';

    if (!connecte && reservee) {
      aller({ nom: 'vitrine' });
    }
  }, [connecte, vue, aller]);

  /*
   * Un mot de passe provisoire barre tout le reste.
   *
   * Quelqu'un d'autre le connait — un administrateur vient de le dicter. Le
   * laisser servir le temps qu'on y pense reviendrait a annuler l'interet du
   * provisoire.
   */
  if (connecte && monCompte?.mustChangePassword) {
    return <MonCompte compte={monCompte} onRetour={() => undefined} onChange={relireCompte} impose />;
  }

  if (vue.nom === 'connexion') {
    return (
      <ConnexionPlateforme
        onConnecte={() => {
          /*
           * La page est rechargee apres connexion : la session vit dans un
           * cookie que le reste de l'application lit au demarrage, et lui
           * faire redecouvrir cet etat en cours de route serait plus fragile
           * qu'un rechargement franc.
           */
          window.location.search = '?espace=mes-evenements';
        }}
        onRetour={() => aller({ nom: 'vitrine' })}
      />
    );
  }

  if (vue.nom === 'mes-billets') {
    return (
      <MesBillets slug={vue.slug} onRetour={() => aller({ nom: 'evenement', slug: vue.slug })} />
    );
  }

  if (vue.nom === 'evenement') {
    return (
      <PageEvenement
        slug={vue.slug}
        onRetour={() => aller({ nom: 'vitrine' })}
        onMesBillets={() => aller({ nom: 'mes-billets', slug: vue.slug })}
      />
    );
  }

  if (vue.nom === 'creation') {
    return (
      <CreerEvenement
        onCree={() => aller({ nom: 'mes-evenements' })}
        onAnnuler={() => aller({ nom: 'mes-evenements' })}
      />
    );
  }

  if (vue.nom === 'mon-compte') {
    if (!monCompte) {
      return (
        <div className="min-h-screen bg-[#FDFCFB] dark:bg-stone-950 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
        </div>
      );
    }

    return (
      <MonCompte
        compte={monCompte}
        onRetour={() => aller({ nom: 'mes-evenements' })}
        onChange={relireCompte}
      />
    );
  }

  if (vue.nom === 'plateforme') {
    return <TableauDeBord onRetour={() => aller({ nom: 'mes-evenements' })} />;
  }

  if (vue.nom === 'mes-evenements') {
    return (
      <MesEvenements
        onCreer={() => aller({ nom: 'creation' })}
        onOuvrir={slug => aller({ nom: 'evenement', slug })}
        onVitrine={() => aller({ nom: 'vitrine' })}
        onPlateforme={() => aller({ nom: 'plateforme' })}
        onMonCompte={() => aller({ nom: 'mon-compte' })}
      />
    );
  }

  return (
    <Vitrine
      onOuvrir={slug => aller({ nom: 'evenement', slug })}
      onConnexion={() => aller({ nom: connecte ? 'mes-evenements' : 'connexion' })}
    />
  );
};

/** Dit si l'adresse demande la plateforme plutot qu'un evenement particulier. */
export function adresseDemandeLaPlateforme(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('evenement') || params.has('espace') || params.has('plateforme');
}
