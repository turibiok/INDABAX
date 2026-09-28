import React, { useCallback, useEffect, useState } from 'react';

import { CreerEvenement } from './CreerEvenement';
import { MesEvenements } from './MesEvenements';
import { PageEvenement } from './PageEvenement';
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
  | { nom: 'creation' };

/** Lit la vue depuis l'adresse. */
function vueDepuisAdresse(): Vue {
  const params = new URLSearchParams(window.location.search);

  const slug = params.get('evenement');
  if (slug) return { nom: 'evenement', slug };

  const espace = params.get('espace');
  if (espace === 'mes-evenements') return { nom: 'mes-evenements' };
  if (espace === 'creation') return { nom: 'creation' };

  return { nom: 'vitrine' };
}

/** Ecrit la vue dans l'adresse, sans recharger la page. */
function poserAdresse(vue: Vue) {
  const params = new URLSearchParams(window.location.search);

  params.delete('evenement');
  params.delete('espace');

  if (vue.nom === 'evenement') params.set('evenement', vue.slug);
  if (vue.nom === 'mes-evenements') params.set('espace', 'mes-evenements');
  if (vue.nom === 'creation') params.set('espace', 'creation');

  const suite = params.toString();
  window.history.pushState({}, '', suite ? `?${suite}` : window.location.pathname);
}

export const Plateforme: React.FC<PlateformeProps> = ({ connecte, onConnexion }) => {
  const [vue, setVue] = useState<Vue>(vueDepuisAdresse);

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
    if (!connecte && (vue.nom === 'mes-evenements' || vue.nom === 'creation')) {
      aller({ nom: 'vitrine' });
    }
  }, [connecte, vue, aller]);

  if (vue.nom === 'evenement') {
    return <PageEvenement slug={vue.slug} onRetour={() => aller({ nom: 'vitrine' })} />;
  }

  if (vue.nom === 'creation') {
    return (
      <CreerEvenement
        onCree={() => aller({ nom: 'mes-evenements' })}
        onAnnuler={() => aller({ nom: 'mes-evenements' })}
      />
    );
  }

  if (vue.nom === 'mes-evenements') {
    return (
      <MesEvenements
        onCreer={() => aller({ nom: 'creation' })}
        onOuvrir={slug => aller({ nom: 'evenement', slug })}
        onVitrine={() => aller({ nom: 'vitrine' })}
      />
    );
  }

  return (
    <Vitrine
      onOuvrir={slug => aller({ nom: 'evenement', slug })}
      onConnexion={() => (connecte ? aller({ nom: 'mes-evenements' }) : onConnexion())}
    />
  );
};

/** Dit si l'adresse demande la plateforme plutot qu'un evenement particulier. */
export function adresseDemandeLaPlateforme(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('evenement') || params.has('espace') || params.has('plateforme');
}
