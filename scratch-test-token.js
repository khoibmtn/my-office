const token = "dummy";
fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`).then(res => res.json()).then(console.log);
