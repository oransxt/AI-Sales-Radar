import html,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
def inline(s):
    s=html.escape(s)
    s=re.sub(r'\*\*(.+?)\*\*',r'<b>\1</b>',s)
    s=re.sub(r'`([^`]+)`',r'<code>\1</code>',s)
    s=re.sub(r'(https://[^\s<]+)',r'<a href="\1" target="_blank" rel="noopener">\1</a>',s)
    return s
lines=(root/'README-TH.md').read_text().splitlines()
out=[];fence=False;code=[];table=[]
def flush_table():
    global table
    if not table:return
    head=table[0];body=table[2:]
    def cells(row,tag):return ''.join(f'<{tag}>{inline(c.strip())}</{tag}>' for c in re.split(r'(?<!\\)\|',row.strip().strip('|')))
    out.append('<div class="scroll"><table><tr>'+cells(head,'th')+'</tr>'+''.join('<tr>'+cells(row,'td')+'</tr>' for row in body)+'</table></div>');table=[]
for line in lines:
    if line.startswith('```'):
        flush_table()
        if fence:out.append('<pre>'+html.escape('\n'.join(code))+'</pre>');code=[]
        fence=not fence;continue
    if fence:code.append(line);continue
    if line.startswith('|'):table.append(line);continue
    flush_table()
    if not line:continue
    if line.startswith('# '):continue
    if line.startswith('### '):out.append('<h3>'+inline(line[4:])+'</h3>')
    elif line.startswith('## '):out.append('<h2>'+inline(line[3:])+'</h2>')
    elif line.startswith('- '):out.append('<p class="bullet">• '+inline(line[2:])+'</p>')
    else:out.append('<p>'+inline(line)+'</p>')
flush_table()
files=['Code.gs','Core.gs','Seed.gs','Review.html','appsscript.json']
copy=''
for i,name in enumerate(files):
    src=html.escape((root/'apps-script'/name).read_text())
    copy+=f'<details class="source"><summary>{name} <span>{len(src):,} characters</span></summary><button onclick="copyCode(\'code{i}\',this)">Copy {name}</button><textarea id="code{i}" readonly>{src}</textarea></details>'
page='''<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SignalBridge — Install guide</title><style>body{margin:0;background:#eff5f5;color:#183243;font:15px/1.8 Arial,Tahoma,sans-serif}header{background:#102e3b;color:white;padding:40px max(24px,calc((100vw - 1060px)/2))}h1{font-size:30px;margin:0}header p{color:#afcbcf}main{max-width:1060px;margin:26px auto;padding:28px 38px;background:white;border-radius:14px}h2{color:#00796c;margin-top:40px;border-top:1px solid #dae6e7;padding-top:22px}h3{margin-top:30px}a{color:#00796c;word-break:break-word}code{background:#edf4f5;padding:2px 5px;border-radius:4px;font-size:13px}pre{background:#143243;color:#e7f2f3;padding:18px;overflow:auto;font-size:13px}table{border-collapse:collapse;width:100%;font-size:13px}td,th{border-bottom:1px solid #d8e4e7;padding:10px;text-align:left;vertical-align:top}th{background:#ecf5f2}.scroll{overflow:auto}.bullet{margin:5px 0 5px 15px}.source{background:#f4f8f9;border:1px solid #d3e4e5;border-radius:8px;padding:14px;margin:10px 0}.source summary{cursor:pointer;font-weight:bold}.source summary span{float:right;font-weight:normal;font-size:11px;color:#768c92}.source button{padding:9px 16px;background:#00796c;border:0;border-radius:6px;color:white;cursor:pointer;margin:14px 0}.source textarea{width:100%;height:190px;white-space:pre;font-family:monospace;box-sizing:border-box;font-size:11px;padding:12px}.status{background:#e5f3ed;color:#20674f;padding:15px;border-radius:8px;font-size:13px}@media(max-width:650px){main{padding:20px}header{padding:25px}h1{font-size:24px}}</style></head><body><header><h1>SIGNALBRIDGE</h1><p>Share relevant knowledge. Two email languages. One final decision.</p></header><main><div class="status">ชุดติดตั้ง SignalBridge 2.3.1 Knowledge · Gemini บริษัทผ่านหน้าเว็บ · ยังต้องเชื่อมบัญชี Google ครั้งแรก</div><h2>Copy code สำหรับติดตั้ง</h2><p>สร้าง Script 3 ไฟล์ (Code, Core, Seed), HTML ชื่อ Review และ Manifest ตามคู่มือด้านล่าง ใช้ปุ่ม Copy เพื่อคัดลอกเนื้อหาทั้งไฟล์</p>'''+copy+''.join(out)+'''</main><script>async function copyCode(id,button){let e=document.getElementById(id);try{await navigator.clipboard.writeText(e.value)}catch{e.focus();e.select();document.execCommand('copy')}button.textContent='Copied';setTimeout(()=>button.textContent='Copy code',2000)}</script></body></html>'''
fontcss='body{font-family:Arial,Tahoma,sans-serif}'
page=page.replace('<style>','<style>'+fontcss,1).replace('Arial,Tahoma,sans-serif','Arial,Tahoma,sans-serif',1)
(root/'Install-Guide.html').write_text(page)

print('Guide with copy buttons built')
