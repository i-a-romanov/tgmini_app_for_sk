import {readFile} from 'node:fs/promises';
import {parse} from 'yaml';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const blueprint=parse(await readFile(new URL('../render.yaml',import.meta.url),'utf8'));
const schema=process.env.RENDER_SCHEMA_FILE?JSON.parse(await readFile(process.env.RENDER_SCHEMA_FILE,'utf8')):
  await (await fetch('https://render.com/schema/render.yaml.json')).json();
const ajv=new Ajv({allErrors:true,strict:false});addFormats(ajv);
const validate=ajv.compile(schema);
if(!validate(blueprint)){console.error(validate.errors);process.exit(1)}
console.log('render.yaml matches the official Render JSON Schema');
