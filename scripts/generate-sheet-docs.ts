import fs from 'fs';
import path from 'path';
import { SHEET_TEMPLATES, SheetTemplate, templateToCsv } from '../src/data/sheetTemplates';

/**
 * Génère `docs/MODELE-CLASSEUR.md` à partir de `src/data/sheetTemplates.ts`.
 *
 * La documentation et les modèles affichés dans l'application proviennent ainsi
 * de la même source : ils ne peuvent pas divulguer des colonnes différentes.
 *
 * Usage : npm run docs:sheets
 */

const DOC_PATH = path.join(process.cwd(), 'docs', 'MODELE-CLASSEUR.md');

/** Échappe les barres verticales pour ne pas casser les tableaux Markdown. */
function cell(value: string): string {
  const escaped = value.replace(/\|/g, '\\|');
  return escaped || '_(vide)_';
}

function markdownTable(template: SheetTemplate): string {
  const header = `| ${template.headers.map(cell).join(' | ')} |`;
  const separator = `| ${template.headers.map(() => '---').join(' | ')} |`;
  const rows = template.rows.map(row => `| ${row.map(cell).join(' | ')} |`);

  return [header, separator, ...rows].join('\n');
}

function section(template: SheetTemplate, index: number): string {
  const lines: string[] = [];

  lines.push(`## ${index}. Onglet \`${template.tab}\``);
  lines.push('');
  lines.push(`**Rôle.** ${template.purpose}`);
  lines.push('');

  const directionText: Record<SheetTemplate['direction'], string> = {
    lecture: "Lue par l'application. Vous la remplissez, elle ne la modifie pas.",
    'écriture': "Remplie par l'application. Créez seulement l'onglet et sa ligne d'en-têtes.",
    'lecture-écriture': "Lue et complétée par l'application.",
  };

  lines.push(`**Sens.** ${directionText[template.direction]}`);
  lines.push('');

  if (template.requiredColumns.length > 0) {
    lines.push(`**Colonne indispensable.** \`${template.requiredColumns.join('`, `')}\``);
    lines.push('');
  }

  lines.push('### Colonnes et exemple');
  lines.push('');
  lines.push(markdownTable(template));
  lines.push('');

  const aliasEntries = Object.entries(template.aliases);
  if (aliasEntries.length > 0) {
    lines.push('### Libellés de colonnes également acceptés');
    lines.push('');
    lines.push("La lecture ignore les accents, les majuscules et les séparateurs. Ces variantes fonctionnent aussi :");
    lines.push('');
    for (const [column, values] of aliasEntries) {
      lines.push(`- \`${column}\` — ${values.map(value => `\`${value}\``).join(', ')}`);
    }
    lines.push('');
  }

  if (template.notes.length > 0) {
    lines.push('### À savoir');
    lines.push('');
    for (const note of template.notes) {
      lines.push(`- ${note}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildDocument(): string {
  const lines: string[] = [];

  lines.push('# Modèle du classeur Google Sheet');
  lines.push('');
  lines.push(
    "Ce document décrit le classeur qui sert de base de données à l'application IndabaX Bénin. " +
      "Il est **généré** depuis `src/data/sheetTemplates.ts` : ne le modifiez pas à la main, " +
      'éditez la source puis relancez `npm run docs:sheets`.',
  );
  lines.push('');

  lines.push('## Mise en place');
  lines.push('');
  lines.push('1. Créez un classeur Google Sheet, ou réutilisez celui de votre application AppSheet.');
  lines.push(
    '2. Créez un onglet par feuille décrite ci-dessous, en recopiant la ligne d\'en-têtes. Les modèles sont ' +
      'téléchargeables au format CSV depuis l\'application : **Base Google Sheet → Modèles des feuilles**.',
  );
  lines.push(
    '3. Partagez le classeur en lecture avec « Tous les utilisateurs disposant du lien » : sans cela, le serveur ' +
      'reçoit une page de connexion à la place des données.',
  );
  lines.push(
    "4. Dans l'application, connectez-vous avec un email de `ADMIN_EMAILS`, puis collez le lien du classeur dans " +
      '**Base Google Sheet → Classeur & rôles** et cliquez sur « Tester et lier le classeur ».',
  );
  lines.push(
    "5. Pour que l'application puisse **écrire** les émargements et les feedbacks, déployez le script Apps Script " +
      "fourni dans l'onglet **Écriture**, ou renseignez les identifiants de l'API AppSheet.",
  );
  lines.push('');

  lines.push('## Ce que le serveur seul connaît');
  lines.push('');
  lines.push(
    "Le lien du classeur, l'URL du Apps Script et la clé AppSheet sont enregistrés dans `.data/server-state.json`, " +
      'hors du dépôt Git. Ils ne redescendent jamais dans le navigateur. Les mots de passe ne sont conservés que ' +
      'sous forme d\'empreinte scrypt.',
  );
  lines.push('');

  lines.push('## Résumé des onglets');
  lines.push('');
  lines.push('| Onglet | Rôle | Sens |');
  lines.push('| --- | --- | --- |');
  for (const template of SHEET_TEMPLATES) {
    lines.push(`| \`${template.tab}\` | ${template.purpose.split('.')[0]}. | ${template.direction} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  SHEET_TEMPLATES.forEach((template, index) => {
    lines.push(section(template, index + 1));
    lines.push('---');
    lines.push('');
  });

  lines.push('## Annexe : les mêmes feuilles au format CSV');
  lines.push('');
  lines.push(
    "Collez ces blocs dans un fichier `.csv` puis importez-le dans Google Sheets " +
      '(**Fichier → Importer**), ou téléchargez-les directement depuis l\'application.',
  );
  lines.push('');

  for (const template of SHEET_TEMPLATES) {
    lines.push(`### ${template.tab}`);
    lines.push('');
    lines.push('```csv');
    lines.push(templateToCsv(template).replace(/\r\n/g, '\n'));
    lines.push('```');
    lines.push('');
  }

  return lines.join('\n');
}

fs.mkdirSync(path.dirname(DOC_PATH), { recursive: true });
fs.writeFileSync(DOC_PATH, buildDocument());

console.log(
  `docs/MODELE-CLASSEUR.md généré — ${SHEET_TEMPLATES.length} onglets, ` +
    `${SHEET_TEMPLATES.reduce((total, template) => total + template.rows.length, 0)} lignes d'exemple.`,
);
