
const axios = require("axios");

const SHEET_URL = "https://script.google.com/macros/s/AKfycbw98YESWy0vKhmDxyrS_H8OoZ8XalHh0FZutxfB4_9NYlPUFBroHEt_Mbd_5EizGW5flQ/exec";

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
