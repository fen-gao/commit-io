const axios = require("axios");

const apiKey = "MINHA CHAVE";
const orgId = "ORG_ID";

const prompt = "Me diga o nome de 5 frutas";

const requestBody = {
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: prompt }],
  max_tokens: 60,
  n: 1,
  stop: null,
  temperature: 0.5,
};

const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${apiKey}`,
  "OpenAI-Organization": orgId,
};

axios
  .post("https://api.openai.com/v1/chat/completions", requestBody, {
    headers: headers,
  })
  .then((response) => {
    console.log(
      "Response from OpenAI:",
      response.data.choices[0].message.content.trim()
    );
  })
  .catch((error) => {
    console.error(
      "Error calling OpenAI API:",
      error.response ? error.response.data : error.message
    );
  });
