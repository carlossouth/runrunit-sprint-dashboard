async function test() {
  try {
    const res = await fetch('https://runrun.it/api/v1.0/users?limit=5', {
      headers: {
        'App-Key': '3cc25c883a7cae4884858326416d7f0a',
        'User-Token': 'ENx51flBIcuEfVzraNq5'
      }
    });

    const users = await res.json();
    console.log(`Fetched ${users.length} users.`);
    console.log(JSON.stringify(users[0], null, 2));

  } catch (e) {
    console.error(e);
  }
}

test();
