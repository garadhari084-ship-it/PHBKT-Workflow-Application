import fetch from 'node-fetch';

async function test() {
  const res = await fetch('http://localhost:3000/api/generate-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: "John",
      agentName: "Jane",
      workType: "New Business",
      task: "Contact",
      emailPurpose: "Follow up",
      companyName: "Test"
    })
  });
  console.log(res.status, await res.text());
}

test();
