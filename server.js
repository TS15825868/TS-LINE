
const axios = require("axios");

const SHEET_URL = "https://script.google.com/macros/s/AKfycbzVp13_yn_7Zn589Sj1isl4GhyNc7qhCNbkJ5ecPjfvd_d4-JWu3w6PLEM9IINaicpr8Q/exec";

async function sendOrder(state){
  await axios.post(SHEET_URL, {
    name: state.name,
    phone: state.phone,
    shipping: state.shipping,
    address: state.address,
    product: state.product,
    qty: state.qty,
    payment: state.payment,
    note: ""
  }).catch(()=>{});
}

module.exports = { sendOrder };
