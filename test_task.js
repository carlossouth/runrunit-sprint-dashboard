async function test() {
  const APP_KEY = process.env.RUNRUNIT_APP_KEY || '3cc25c883a7cae4884858326416d7f0a';
  const USER_TOKEN = process.env.RUNRUNIT_USER_TOKEN || 'ENx51flBIcuEfVzraNq5';
  const res = await fetch('https://runrun.it/api/v1.0/tasks/68205', {
    headers: { 'App-Key': APP_KEY, 'User-Token': USER_TOKEN }
  });
  const t = await res.json();
  console.log("Keys:", Object.keys(t));
  console.log("is_working_on:", t.is_working_on);
  console.log("is_delivering:", t.is_delivering);
  console.log("on_going:", t.on_going);
}
test();

