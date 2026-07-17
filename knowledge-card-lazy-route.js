"use strict";
const fs=require("fs/promises");
const {app}=require("./server");
const {CARDS,renderCardFile}=require("./knowledge-card-server");
const VERSION="1.0.0";
const mounted=Symbol.for("xjw.knowledge-card-lazy-route");
async function usable(file){try{const stat=await fs.stat(file);return stat.isFile()&&stat.size>1000}catch{return false}}
if(!app[mounted]){app[mounted]=true;app.get("/social-assets/knowledge/v10/:slug.png",async(req,res,next)=>{const slug=String(req.params.slug||"");if(!Object.prototype.hasOwnProperty.call(CARDS,slug))return next();try{const file=await renderCardFile(slug);if(!file||!(await usable(file)))return res.status(503).send("image temporarily unavailable");res.set({"Content-Type":"image/png","Cache-Control":"public, max-age=604800, stale-while-revalidate=86400","X-XJW-Knowledge-Card-Source":`lazy-${VERSION}-v10`,"X-XJW-Layout":"approved-integrated-square"});return res.sendFile(file)}catch(error){console.error("lazy official mascot image failed",slug,error.message);return res.status(503).send("image temporarily unavailable")}})}
module.exports={VERSION};