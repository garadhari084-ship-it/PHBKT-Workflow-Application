console.log(process.env.GOOGLE_APPLICATION_CREDENTIALS ? 'SET' : 'NOT SET');
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  try {
    const json = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS);
    console.log("JSON parsed. Project ID:", json.project_id);
  } catch(e) {
    console.log("Could not parse as JSON. Assuming path.");
  }
}
