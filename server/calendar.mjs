function utc(date) { return new Date(date).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''); }
function escapeText(text) { return text.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }
function fold(line) {
  let output='',column=0;
  for(const character of line){const bytes=Buffer.byteLength(character);if(column+bytes>73){output+='\r\n ';column=1}output+=character;column+=bytes}
  return output;
}
export function calendarFile(deadline) {
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//SK Fast Track//Personal deadline//RU','BEGIN:VEVENT',
    `UID:${deadline.id}@skfasttrack`,`DTSTAMP:${utc(new Date())}`,`DTSTART:${utc(deadline.due_at)}`,
    `DTEND:${utc(new Date(new Date(deadline.due_at).getTime()+30*60000))}`,`SUMMARY:${escapeText(deadline.title)}`,
    'DESCRIPTION:Личный дедлайн в SK Fast Track','BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',
    'DESCRIPTION:Дедлайн завтра','END:VALARM','END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
