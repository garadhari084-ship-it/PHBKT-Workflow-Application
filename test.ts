async function run() {
  const res = await fetch('https://phbkt-workflow-application.vercel.app/api/generate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: 'Test',
      agentName: 'Agent',
      workType: 'Type',
      task: 'Task',
      emailPurpose: 'Purpose',
      companyName: 'Test'
    })
  });
  console.log(res.status, await res.text());
}
run();
