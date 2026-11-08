export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  const { url } = req.body || {};

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({ error: 'Lien invalide' });
  }

  let texte = '';
  try {
    const page = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; 3PNT-ELEC-Devis)',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      },
      redirect: 'follow'
    });
    const html = await page.text();

    const titre = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
    const blocsJson = (html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi) || []).join(' ');
    const metas = (html.match(/<meta[^>]+(price|og:title|og:description)[^>]*>/gi) || []).join(' ');
    const corps = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 4000);

    texte = (titre + ' ' + metas + ' ' + blocsJson).slice(0, 5000) + ' ' + corps;
  } catch (e) {
    return res.status(200).json({ trouve: false, raison: 'Page illisible' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({ trouve: false, raison: 'Cle manquante' });
  }

  const prompt = `Voici le contenu brut d'une page de magasin en ligne. Trouve le produit principal et son prix en euros TTC.
Reponds uniquement avec un objet JSON de cette forme exacte : {"nom": "...", "prix": 12.5, "unite": "u"}
L'unite est "m2" si le prix est au metre carre, sinon "u". Si tu ne trouves pas un prix certain, reponds {"nom": "", "prix": 0, "unite": "u"}. N'invente jamais un prix.

Contenu :
${texte}`;

  try {
    const reponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0
      })
    });

    const data = await reponse.json();
    const brut = data.choices?.[0]?.message?.content || '';
    const json = JSON.parse((brut.match(/\{[\s\S]*\}/) || ['{}'])[0]);

    if (json.prix && json.prix > 0) {
      return res.status(200).json({
        trouve: true,
        nom: json.nom || 'Article',
        prix: Number(json.prix),
        unite: json.unite === 'm2' ? 'm²' : 'u'
      });
    }
    return res.status(200).json({ trouve: false, raison: 'Prix introuvable' });
  } catch (e) {
    return res.status(200).json({ trouve: false, raison: 'Lecture impossible' });
  }
}
