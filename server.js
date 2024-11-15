const express = require('express');
const WebSocket = require('ws');
const qs = require('qs');
const fetch = require('node-fetch').default;
require('dotenv').config();
const app = express();
const port = process.env.PORT || 3000;
const { Telegraf } = require('telegraf');
const Alpaca = require("@alpacahq/alpaca-trade-api");
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const { Client } = require('pg');
const cron = require('node-cron');
const axios = require('axios');
const alpaca = new Alpaca({
    keyId: process.env.ALPACA_API_KEY_ID,
    secretKey: process.env.ALPACA_API_SECRET_KEY,
    paper: true,
});
const chat_id = process.env.TELEGRAM_CHAT_ID;
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const generativeModel = genAI.getGenerativeModel({ model: "gemini-pro" });
let websocket;
let listen;
let tokens;
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
                if(listen){
                    tokens = await getAllTokens();
                    if(tokens != [] && tokens.includes(symbol)){
                        console.log(symbol);
                        const companyImpactGemini = await connectToGemini(currentEvent.headline);
                        console.log(companyImpactGemini);
                        const companyImpactGPT = await connectToGPT(currentEvent.headline);
                        console.log(companyImpactGPT);
                        console.log(`Compra esta accionnnn ${symbol}`);
                        let multiplicador = 3;
                        let estado = "BUENA";
                        if ((companyImpactGPT >= 85 && companyImpactGemini >= 80) || (companyImpactGPT >= 80 && companyImpactGemini >= 85) || (companyImpactGPT >= 90) || (companyImpactGemini >= 90)) {
                            multiplicador = 6;
                            estado = "MUY BUENA";
                        }
                        if ((companyImpactGPT >= 93 && companyImpactGemini >= 90) || (companyImpactGPT >= 90 && companyImpactGemini >= 93) || (companyImpactGPT >= 95) || (companyImpactGemini >= 95)) {
                            multiplicador = 10;
                            estado = "EXCELENTE";
                        }
                        if ((companyImpactGPT >= 75 && companyImpactGemini >= 70) || (companyImpactGPT >= 70 && companyImpactGemini >= 75) || (companyImpactGPT >= 80) || (companyImpactGemini >= 80)) {
                            const messageTelegram = "Comprar acciones de " + symbol + ", la oportunidad es " + estado + "\n " +
                                "Los valores de las IA son:\n" +
                                companyImpactGPT + " de chat GPT\n" +
                                companyImpactGemini + " de Gemini";
                            //trading_alpaca_buy(symbol,multiplicador);
                            //sendMessageToTelegram(messageTelegram, chat_id);
                        }else if ((companyImpactGemini > 1 && companyImpactGemini <= 30 && companyImpactGPT <= 30)) {
                            const messageTelegram = "Vender acciones de " + symbol + "\n" +
                                "Los valores son:\n" +
                                companyImpactGPT + " de chat GPT\n" +
                                companyImpactGemini + " de Gemini";
                            //trading_alpaca_sell(symbol);
                            //sendMessageToTelegram(messageTelegram, chat_id);
                        }
                    }
                }else{
                    console.log(symbol);
                    //const token_iol= await authenticate();
                    //const flag = await symbolIsOk(symbol,token_iol);
                    //if(flag){
                    const companyImpactGemini = await connectToGemini(currentEvent.headline);
                    console.log(companyImpactGemini);
                    const companyImpactGPT = await connectToGPT(currentEvent.headline);
                    console.log(companyImpactGPT);
                    console.log(`Compra esta accionnnn ${symbol}`);
                    let multiplicador = 3;
                    let estado = "BUENA";
                    if ((companyImpactGPT >= 85 && companyImpactGemini >= 80) || (companyImpactGPT >= 80 && companyImpactGemini >= 85) || (companyImpactGPT >= 90) || (companyImpactGemini >= 90)) {
                        multiplicador = 6;
                        estado = "MUY BUENA";
                    }
                    if ((companyImpactGPT >= 93 && companyImpactGemini >= 90) || (companyImpactGPT >= 90 && companyImpactGemini >= 93) || (companyImpactGPT >= 95) || (companyImpactGemini >= 95)) {
                        multiplicador = 10;
                        estado = "EXCELENTE";
                    }
                    if ((companyImpactGPT >= 75 && companyImpactGemini >= 70) || (companyImpactGPT >= 70 && companyImpactGemini >= 75) || (companyImpactGPT >= 80) || (companyImpactGemini >= 80)) {
                        const messageTelegram = "Comprar acciones de " + symbol + ", la oportunidad es " + estado + "\n " +
                            "Los valores de las IA son:\n" +
                            companyImpactGPT + " de chat GPT\n" +
                            companyImpactGemini + " de Gemini";
                        //trading_alpaca_buy(symbol,multiplicador);
                        //sendMessageToTelegram(messageTelegram, chat_id);
                    }else if ((companyImpactGemini > 1 && companyImpactGemini <= 30 && companyImpactGPT <= 30)) {
                        const messageTelegram = "Vender acciones de " + symbol + "\n" +
                            "Los valores son:\n" +
                            companyImpactGPT + " de chat GPT\n" +
                            companyImpactGemini + " de Gemini";
                        //trading_alpaca_sell(symbol);
                        //sendMessageToTelegram(messageTelegram, chat_id);
                    }
                }
                
               // }

                //}
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
        }
    });

    wss.on('close', function() {
        console.log("Websocket disconnected!");
        //sendMessageToTelegram('¡El websocket se ha desconectado!', chat_id);
    });
    return wss;
}
function stopWebSocket(wss) {
    if (wss && wss.readyState === WebSocket.OPEN) {
        wss.close();
        console.log("WebSocket closed.");
    } else {
        console.log("WebSocket is not open or already closed.");
    }
}
async function connectToGPT(news){
    const question = "Given the headline '" + news + "', consider this in the context of financial trading. Respond with a number from 1-100 to indicate the short-term impact on the stock price, where 100 means a strong buy signal and 1 means a strong sell signal.";
    const apiRequestBodyGPT = {
    model: "gpt-3.5-turbo-0125",
    messages: [
        { role: "system", content: "You are a financial trading assistant. Only respond with a number from 1-100 indicating the likely short-term impact on the stock price based on the given headline. A score of 100 represents a strong buy signal, while a score of 1 represents a strong sell signal." },
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
    const question = "Given the headline '" + news + "', consider this in the context of financial trading. Respond with a number from 1-100 to indicate the short-term impact on the stock price, where 100 means a strong buy signal and 1 means a strong sell signal.";
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
bot.hears(/^\/add\s+(\w+)$/i, async (ctx) => {
    const token = ctx.match[1].toUpperCase();
    // Lógica para guardar el token en la base de datos
    await insertToken(token);
    await ctx.reply(`Token ${token} agregado a la base de datos.`);
    // await saveTokenToDatabase(token); // Llama a tu función de guardado aquí
});
bot.hears(/^\/delete\s+(\w+)$/i, async (ctx) => {
    const token = ctx.match[1].toUpperCase();
    deleteToken(token);
    // Lógica para eliminar el token de la base de datos
    await ctx.reply(`Token ${token} eliminado de la base de datos.`);
    // await deleteTokenFromDatabase(token); // Llama a tu función de eliminación aquí
});
bot.start((ctx) => {
    websocket=startWebSocket();
    ctx.reply("Se inicio la app. Para detenerla usa /stop.");
});
bot.command('stop', async (ctx) => {
    stopWebSocket(websocket);
    await ctx.reply("Se detuvo la app. Para volver a activarlo, usa /start.");
});
bot.command('get', async (ctx) => {
    const get_tokens = await getAllTokens();
    if(get_tokens != []){
        await ctx.reply(tokens);
    }
});
bot.command('listen', async (ctx) => {
    listen= true;
});

bot.command('wait', async (ctx) => {
    listen = false;
});
async function createTable() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
        await client.connect();
        await client.query(`
            CREATE TABLE IF NOT EXISTS acciones (
                token VARCHAR(50) PRIMARY KEY
            );
        `);
        console.log("Tabla 'acciones' creada o ya existente.");
    } catch (err) {
        console.error("Error al crear la tabla:", err);
    } finally {
        await client.end();
    }
}
async function insertToken(token) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const query = 'INSERT INTO acciones (token) VALUES ($1) ON CONFLICT (token) DO NOTHING';
    try {
        await client.connect();
        await client.query(query, [token]);
        console.log(`Token ${token} agregado a la base de datos.`);
    } catch (error) {
        console.error('Error al insertar el token:', error);
    }finally {
        await client.end();
    }
}
async function deleteToken(token) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const query = 'DELETE FROM acciones WHERE token = $1';
    try {
        await client.connect();
        const res = await client.query(query, [token]);
        if (res.rowCount > 0) {
            console.log(`Token ${token} eliminado de la base de datos.`);
        } else {
            console.log(`Token ${token} no encontrado en la base de datos.`);
        }
    } catch (error) {
        console.error('Error al eliminar el token:', error);
    }finally {
        await client.end();
    }
}

async function getAllTokens() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const query = 'SELECT token FROM acciones';
    try {
        await client.connect();
        const res = await client.query(query);
        const tokens = res.rows.map(row => row.token);
        console.log("Tokens en la base de datos:", tokens);
        return tokens;
    } catch (error) {
        console.error('Error al obtener los tokens:', error);
        return [];
    }finally {
        await client.end();
    }
}
/*app.post('/webhook-telegram', async (req, res) => {
    const message = req.body.message;
    
    // Verifica si `message` está definido
    if (message && message.text) {
        const chatId = message.chat.id;
        const text = message.text.trim();
        
        // Verificar si el mensaje sigue el formato "add <TOKEN>"
        const match = text.match(/^add\s+(\w+)$/i);
        if (match) {
            const token = match[1].toUpperCase();
            await sendMessageToTelegram(`Token ${token} agregado a la base de datos`);
        }
    } else {
        console.log("Solicitud sin 'message' recibida:", req.body);
    }
    
    res.sendStatus(200); // Responder con un 200 para confirmar la recepción a Telegram
});*/


app.listen(port, async () => {
    console.log(`Servidor escuchando en el puerto ${port}`);
    createTable();
    bot.launch();
    cron.schedule('*/4 * * * *', async () => {
        try {
            await axios.get('https://tu-aplicacion.com'); // Reemplaza con la URL de tu aplicación
            console.log('Ping exitoso para mantener la aplicación activa');
        } catch (error) {
            console.error('Error al hacer ping a la aplicación:', error);
        }
    });
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

async function trading_alpaca_buy(tickerSymbol, cantidad) {
    const order = await alpaca.createOrder({
        symbol: tickerSymbol,
        qty: cantidad,
        side: 'buy',
        type: 'market',
        time_in_force: 'day' // Orden válida solo durante el día
    });
    console.log(order);
}
async function trading_alpaca_sell(tickerSymbol) {
    const closedPosition = await alpaca.closePosition(tickerSymbol);
    console.log(closedPosition);
}
