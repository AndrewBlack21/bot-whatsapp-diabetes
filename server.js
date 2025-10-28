const express = require("express");
const { JWT } = require("google-auth-library");
const { GoogleSpreadsheet } = require("google-spreadsheet");
const twilio = require("twilio");

const app = express();
app.use(express.urlencoded({ extended: false }));

// Carrega as variáveis de ambiente
const {
  GOOGLE_SHEET_ID,
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
} = process.env;

// Função para inicializar o Google Sheets
const initSheet = async () => {
  const serviceAccountAuth = new JWT({
    email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
  await doc.loadInfo();
  return doc.sheetsByIndex[0]; // Retorna a primeira aba da planilha
};

// Rota principal que o Twilio vai chamar
app.post("/webhook", async (req, res) => {
  const twiml = new twilio.twiml.MessagingResponse();
  const mensagemRecebida = req.body.Body.toLowerCase().trim();
  const celularUsuario = req.body.From;

  try {
    const sheet = await initSheet();
    const comando = mensagemRecebida.split(" "); // Ex: ['destro', 'jejum', '95']

    if (comando[0] === "destro" && comando.length === 3) {
      const tipo = comando[1];
      const valor = comando[2];

      const agora = new Date();
      const dataFormatada = agora.toLocaleDateString("pt-BR");
      const horaFormatada = agora.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });

      await sheet.addRow({
        data: dataFormatada,
        hora: horaFormatada,
        tipo: tipo,
        valor: valor,
        celular: celularUsuario,
      });

      let mensagemExtra = "";
      if (parseInt(valor) > 180) {
        mensagemExtra =
          "\n\n⚠️ *Atenção!* Sua glicemia está alta. Lembre-se de beber bastante água e seguir as orientações do seu médico.";
      }

      twiml.message(
        `✅ Glicemia de ${valor} (${tipo}) registrada com sucesso!${mensagemExtra}`
      );
    } else if (mensagemRecebida === "relatorio") {
      const sheetURL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/`;
      twiml.message(
        `📈 Aqui está o link para seus relatórios e gráficos:\n${sheetURL}`
      );
    } else {
      twiml.message(
        "Olá! Para registrar sua glicemia, envie uma mensagem no formato:\n\n*destro [tipo] [valor]*\n\nExemplos:\n`destro jejum 98`\n`destro almoco 140`\n\nPara ver seu relatório, envie: *relatorio*"
      );
    }
  } catch (error) {
    console.error("Erro:", error);
    twiml.message(
      "😥 Desculpe, ocorreu um erro ao processar sua solicitação. Tente novamente."
    );
  }

  res.writeHead(200, { "Content-Type": "text/xml" });
  res.end(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
