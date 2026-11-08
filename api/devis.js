export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Methode non autorisee' });
  }

  const { travaux } = req.body || {};

  if (!travaux || !travaux.length) {
    return res.status(400).json({ error: 'Aucun travaux choisi' });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({ devis: 'Voici le detail de votre estimation.' });
  }

  const prompt = `Tu es l'assistant de 3PNT ELEC, une entreprise d'electricite et de renovation.
Le client a choisi : ${JSON.stringify(travaux)}.
Ecris uniquement une courte introduction de devis en francais, 2 phrases maximum, polie et professionnelle, qui resume les travaux demandes. Ne donne aucun prix, aucun tableau, aucune liste.`;

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
      return res.status(200).json({ devis: 'Voici le detail de votre estimation.' });
    }

    const texte = data.choices?.[0]?.message?.content || 'Voici le detail de votre estimation.';
    return res.status(200).json({ devis: texte });
  } catch (e) {
    return res.status(200).json({ devis: 'Voici le detail de votre estimation.' });
  }
}
