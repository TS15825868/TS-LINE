"use strict";

const express = require("express");
const line = require("@line/bot-sdk");
const axios = require("axios");
const fs = require("fs");

const app = express();

// ===== LINE =====
const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN || "IKjy0y2zfPOhMCp7xiJ4R4z7UkkvzoQgj7A6OH1AJjdMYpDnEzaicgz2HWy4pVz1KMSsUHzhoHoXZVztRQwibp3Q8UPfN+Dp4pBfT2k3Mzu5bBtdO1P78Cpffq+75liFPLL3ftcHMzvzr+WOgm6AEgdB04t89/1O/w1cDnyilFU=",
  channelSecret: process.env.CHANNEL_SECRET || "7c3c4740afa5a281d54afb9f8ffc1e96"
};

const client = new line.Client(config);

// ===== CRM =====
const CRM_URL = process.env.CRM_URL || "https://script.google.com/macros/s/AKfycbwAFBxeROd2ZYGJ_h0O7_H2MMxptOMoj3EXIErZpbKuTYFOzOVwQkrk8X1MoxapkHVGSA/exec";

app.post("/webhook", line.middleware(config), async (req, res) => {

  const event = req.body.events[0];
  const msg = event.message.text;

  let reply = "";

  if(msg.includes("入門")){
    reply = "建議先從龜鹿膏或龜鹿飲開始🙂";
  }

  else if(msg.includes("日常")){
    reply = "建議：龜鹿膏＋龜鹿湯塊";
  }

  else if(msg.includes("完整")){
    reply = "建議：全套搭配（膏＋飲＋湯塊＋鹿茸粉）";
  }

  else if(msg.includes("價格") || msg.includes("便宜")){
    reply = "有搭配與活動，可以幫你算🙂";
  }

  else{
    reply = "我先幫你分三種👇\n① 入門\n② 日常\n③ 完整\n直接打其中一個就好🙂";
  }

  return client.replyMessage(event.replyToken, {
    type: "text",
    text: reply
  });

});

app.listen(3000);
