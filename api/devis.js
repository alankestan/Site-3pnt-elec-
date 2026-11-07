export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  const { travaux, details } = req.body || {};

  if (!travaux || !travaux.length) {
    return res.status(400).json({ error: 'Aucun travaux choisi' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'Cle GROQ_API_KEY introuvable sur le serveur.' });
  }

  const prompt = `Tu es l'assistant de devis de 3PNT ELEC, une entreprise d'electricite et de renovation.
Le client demande les travaux suivants : ${JSON.stringify(travaux)}.
Details supplementaires : ${details || 'aucun'}.
Genere un devis clair en francais avec : une ligne par poste (description, quantite, prix unitaire en euros, total), puis le total general. Utilise des prix d'exemple realistes. Termine en precisant que le devis est une estimation non contractuelle.`;

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
        temperature: 0.3
      })
    });

    const data = await reponse.json();

    if (!reponse.ok) {
      const message = data.error?.message || JSON.stringify(data);
      return res.status(200).json({ devis: 'Erreur Groq (' + reponse.status + ') : ' + message });
    }

    const texte = data.choices?.[0]?.message?.content || 'Pas de reponse de l IA.';
    return res.status(200).json({ devis: texte });
  } catch (e) {
    return res.status(200).json({ devis: 'Erreur serveur : ' + e.message });
  }
}
