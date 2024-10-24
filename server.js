const express = require('express');
const WebSocket = require('ws');
const axios = require('axios');
const qs = require('qs');
const fetch = require('node-fetch').default;
require('dotenv').config();
const cron = require('node-cron');
const app = express();
const port = process.env.PORT || 3000;

const Alpaca = require("@alpacahq/alpaca-trade-api");
const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY_ID,
    secretKey: process.env.ALPACA_API_SECRET_KEY,
    paper: true,
});
const chat_id = process.env.TELEGRAM_CHAT_ID;
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });

function startWebSocket() {
    const wss = new WebSocket("wss://stream.data.alpaca.markets/v1beta1/news");

    wss.on('open', function() {
        console.log("Websocket connected!");
        sendMessageToTelegram('Me conecte correctamente', chat_id);
        //authenticate();
        const authMsg = {
            action: 'auth',
            key: process.env.ALPACA_API_KEY_ID,
            secret: process.env.ALPACA_API_SECRET_KEY
        };
        wss.send(JSON.stringify(authMsg));

        const subscribeMsg = {
            action: 'subscribe',
            news: ['*']
        };
        wss.send(JSON.stringify(subscribeMsg));
    });

    wss.on('message', async function(message) {
        try {
            console.log("Message is " + message);
            const currentEvent = JSON.parse(message)[0];

            if (currentEvent.T === "n") {
                
                
             
                const symbol = currentEvent.symbols[0];
                console.log(symbol);
                const token_iol= await authenticate();
                const flag = await symbolIsOk(symbol,token_iol);
                if(flag){
                    const companyImpactGemini = await connectToGemini(currentEvent.headline);
                    console.log(companyImpactGemini);
                    const companyImpactGPT = await connectToGPT(currentEvent.headline);
                    console.log(companyImpactGPT);
                    console.log(`Compra esta accionnnn ${symbol}`)
                }
                
               // }

            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    wss.on('close', function() {
        console.log("Websocket disconnected!");
        //sendMessageToTelegram('¡El websocket se ha desconectado!', chat_id);
    });
}

async function connectToGPT(news){
    const question = "Given the headline '" + news + "', show me a number from 1-100 detailing the impact of this headline.";
    const apiRequestBodyGPT = {
        model: "gpt-3.5-turbo-0125",
        messages: [
            { role: "system", content: "Only respond with a number from 1-100 detailing the impact of the headline." },
            { role: "user", content: question }
        ]
    };

    const responseGPT = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(apiRequestBodyGPT)
    });
    
    if (!responseGPT.ok) {
        const errorDetails = await responseGPT.text();
        throw new Error(`Failed to fetch ChatGPT completion: ${responseGPT.status} - ${errorDetails}`);
    }
    
    const dataGPT = await responseGPT.json();
    
    return parseInt(dataGPT.choices[0].message.content);

}

async function connectToGemini(news) {
    const question = "Given the headline '" + news + "', show me a number from 1-100 detailing the impact of this headline.";
    const requestGemini = {
        contents: [{ role: 'user', parts: [{ text: question }] }],
    };
    const result = await generativeModel.generateContent(requestGemini);
    const responseGemini = await result.response;
    const geminiContent = responseGemini.text();
    const companyImpactGemini = extractCompanyImpact(geminiContent);
    return companyImpactGemini;
}
function extractCompanyImpact(generatedText) {
    const numberPattern = /\b\d+\b/;
    const match = generatedText.match(numberPattern);

    if (match && match.length > 0) {
        const companyImpact = parseInt(match[0]);
        return companyImpact;
    } else {
        return 0;
    }
}

async function authenticate() {
    const data = qs.stringify({
        'username': process.env.IOL_USERNAME ,
        'password': process.env.IOL_PASSWORD,
        'grant_type': 'password'
    });

    try {
        const response = await axios.post('https://api.invertironline.com/token', data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        });

        const accessToken = response.data.access_token;
        console.log('Access Token:', accessToken);
        return accessToken;
    } catch (error) {
        console.error('Error en la autenticación:', error.response ? error.response.data : error.message);
    }
}


async function getCotizacion(token,symbol) {
    const response = await fetch(`https://api.invertironline.com/api/v2/Cotizaciones/MEP/${symbol}`, {
        method: 'GET',
        headers: {
            //'Host' : 'api.invertironline.com',
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorDetails = await response.text();
        console.error(`Error al obtener cotización para ${symbol}: ${response.status} - ${errorDetails}`);
        throw new Error(`Error al obtener cotización: ${response.status} - ${errorDetails}`);
    }

    const data = await response.json();
    return data.ultimoPrecio;
}
async function symbolIsOk(symbol,token) {  // Asegúrate de tener el token actualizado
    const apiURL = `https://api.invertironline.com/api/v2/bCBA/Titulos/${symbol}`;
    console.log(apiURL);
    const response = await fetch(apiURL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    console.log(response);
    if (response.ok) {
        const data = await response.json();
        console.log(`El símbolo ${symbol} está disponible en IOL:`, data);
        return true;
    } else {
        console.error(`El símbolo ${symbol} no está disponible en IOL. Error: ${response.status}`);
        return false;
    }
}
async function getSymbols(token) {
    const url = 'https://api.invertironline.com/api/v2/bCBA/Titulos'; // Cambia bCBA si es necesario

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Verificar si la respuesta es exitosa
        if (!response.ok) {
            // Imprime más detalles del error
            const errorText = await response.text(); // Para obtener más información del error
            throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
        }

        const data = await response.json();
        console.log(data);
        return data;
    } catch (error) {
        console.error('Error al obtener los títulos:', error);
    }
}

app.listen(port, async () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    /*const token = await authenticate();
    const symbols = await getSymbols(token);
    console.log(symbols);*/
    startWebSocket();
    //startKeepAlive();
});
async function sendMessageToTelegram(message, chat_id) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const requestBody = {
        chat_id: chat_id,
        text: message
    };

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const responseData = await response.json();
        //console.log('Message sent successfully:', responseData);
    } catch (error) {
        console.error('Failed to send message:', error);
    }
}