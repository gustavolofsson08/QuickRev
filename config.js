// QuickRev UF: uppgifter som saknas i briefen. Fyll i här, inget annat behöver ändras.
// Tomma fält döljs automatiskt på sidan.
window.QUICKREV = {
  epost: "quickrev.uf@gmail.com", // visas på sidan och används som reserv för formuläret
  telefon: "",                    // t.ex. "070-123 45 67" (tomt = visas inte)
  instagram: "quickrev_uf",       // användarnamn utan @, visas som Instagram-ikon

  // Adress dit formuläret skickas (t.ex. Formspree eller Web3Forms).
  // Lämnas den tom öppnas besökarens mejlprogram med ifyllt mejl till "epost" ovan.
  formEndpoint: "https://formspree.io/f/maeoozal",

  // Vår serverfunktion som ger varje beställning ett löpnummer (QR-001, QR-002 ...).
  // Om den inte svarar skickas beställningen direkt till formEndpoint ovan.
  orderEndpoint: "/api/order",

  // Besöksstatistik utan cookies (Cloudflare Web Analytics, gratis).
  // Skapa konto på dash.cloudflare.com -> Analytics & Logs -> Web Analytics -> Add a site,
  // välj "manual setup" och kopiera token-värdet ur koden de visar. Tomt = ingen statistik.
  statistikToken: "",
};
