from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'downloads/Huurovereenkomst-dakkoffer-met-dakdragers.pdf'
OUT.parent.mkdir(exist_ok=True)
W,H=A4; LEFT=42; WIDTH=W-84; INK=colors.HexColor('#17251f'); GOLD=colors.HexColor('#aa8134'); LIGHT=colors.HexColor('#f4f0e7')
c=canvas.Canvas(str(OUT),pagesize=A4)
c.setTitle('Huurovereenkomst dakkoffer met dakdragers | De Lattenspecialist')
c.setAuthor('De Lattenspecialist - Van Raaij Services')
normal=ParagraphStyle('body',fontName='Helvetica',fontSize=9.2,leading=13,textColor=INK,spaceAfter=5)
small=ParagraphStyle('small',parent=normal,fontSize=8,leading=11)
def para(text,y,style=normal,x=LEFT,width=WIDTH):
 p=Paragraph(text,style);_,height=p.wrap(width,H);p.drawOn(c,x,y-height);return y-height-7
def section(title,y):
 c.setFillColor(GOLD);c.setFont('Helvetica-Bold',11);c.drawString(LEFT,y,title);return y-15
def field(label,name,x,y,width):
 c.setFillColor(INK);c.setFont('Helvetica',8);c.drawString(x,y,label)
 c.acroForm.textfield(name=name,tooltip=label,x=x,y=y-28,width=width,height=22,fontName='Helvetica',fontSize=10,borderColor=colors.HexColor('#bcb4a4'),fillColor=colors.white,textColor=INK,borderWidth=.6,forceBorder=True)
 return y-43
def header(page):
 c.setFillColor(INK);c.rect(0,H-78,W,78,fill=1,stroke=0)
 c.setFillColor(colors.HexColor('#dfbd74'));c.setFont('Helvetica-Bold',11);c.drawString(LEFT,H-28,'DE LATTENSPECIALIST | DAKKOFFER + DAKDRAGERS')
 c.setFillColor(colors.white);c.setFont('Helvetica-Bold',17);c.drawString(LEFT,H-53,'Huurovereenkomst')
 c.setFillColor(INK);c.setFont('Helvetica',8);c.drawString(LEFT,27,'Versie 19 november 2026 | Beide pagina’s horen bij deze overeenkomst.')
 c.drawRightString(W-LEFT,27,f'{page} / 2')
 return H-98
def check(name,text,y):
 c.acroForm.checkbox(name=name,tooltip=text,x=LEFT,y=y-10,size=10,checked=False,borderColor=GOLD,fillColor=colors.white,textColor=INK,buttonStyle='check',forceBorder=True)
 return para(text,y+1,small,x=LEFT+18,width=WIDTH-18)
y=header(1)
y=para('<b>Verhuurder:</b> De Lattenspecialist, handelsnaam van Van Raaij Services<br/>Hollenhof 13, 6659 BW Wamel | KvK 99668637 | WhatsApp 06 18 32 71 32',y)
y=section('1. Huurder en voertuig',y-2)
col=(WIDTH-14)/2
field('Naam huurder','huurder_naam',LEFT,y,WIDTH);y-=43
field('Adres en woonplaats','huurder_adres',LEFT,y,WIDTH);y-=43
field('Telefoon','huurder_telefoon',LEFT,y,col);field('E-mailadres','huurder_email',LEFT+col+14,y,col);y-=43
field('Automerk en model','auto_model',LEFT,y,col);field('Kenteken en bouwjaar','auto_kenteken_bouwjaar',LEFT+col+14,y,col);y-=43
y=section('2. Gehuurde set en afspraken',y)
field('Dakkoffer: merk / type / identificatie','koffer_type',LEFT,y,col);field('Dakdragers: merk / type / montageset','dragers_type',LEFT+col+14,y,col);y-=43
field('Onderhouds- of reserveringscode','onderhoudscode',LEFT,y,col);field('Overige meegeleverde onderdelen','onderdelen',LEFT+col+14,y,col);y-=43
field('Ophalen: datum en tijd','ophalen',LEFT,y,col);field('Terugbrengen: datum en tijd','terugbrengen',LEFT+col+14,y,col);y-=43
field('Afgesproken huurprijs totaal, incl. btw (EUR)','huurprijs',LEFT,y,col);field('Borg (EUR), indien overeengekomen','borg',LEFT+col+14,y,col);y-=43
field('Staat / bestaande schade / verwijzing naar foto’s','staat_bij_uitgifte',LEFT,y,WIDTH);y-=45
c.setFillColor(LIGHT);c.roundRect(LEFT,y-104,WIDTH,108,8,fill=1,stroke=0)
para('<b>Zelf monteren en controleren</b><br/>De huurder verzorgt zelf de deugdelijke montage van zowel de dakdragers als de dakkoffer. De huurder controleert vóór vertrek en tijdens de reis volgens de gebruiksinstructies of alles goed en veilig vastzit. De verhuurder plaatst of bevestigt de set niet op de auto. Kom bij ophalen en terugbrengen met twee volwassenen.',y-8,normal,x=LEFT+12,width=WIDTH-24)
c.showPage()
y=header(2)
y=section('3. Huurafspraken',y)
terms=[
('Alleen voor onderhoudsklanten','De set is een aanvulling op ski- of snowboardonderhoud bij De Lattenspecialist. Een aanvraag of voorlopige reservering wordt definitief na bevestiging van beschikbaarheid, passende combinatie, huurperiode, totaalprijs en deze afspraken. Voor reeds bevestigde reserveringen gelden de eerder overeengekomen afspraken.'),
('Passend en compleet materiaal','De combinatie van voertuig, dakdragers, bevestigingsmiddelen en dakkoffer moet volgens de voertuig- en productinstructies geschikt zijn. Het dakrailtype alleen bewijst dit niet. Controleer bij ontvangst de staat en volledigheid; meld gebreken direct. Bij twijfel over geschiktheid of veiligheid wordt de set niet gebruikt.'),
('Zelf monteren en demonteren','De huurder komt bij ophalen en terugbrengen met twee volwassenen. De huurder plaatst, bevestigt en verwijdert de dragers en de koffer zelf volgens de montage-instructies en gaat zorgvuldig met de auto om. De verhuurder geeft uitleg, maar voert geen montage, demontage of montagekeuring uit.'),
('Montage- en controleverantwoordelijkheid','De huurder is zelf verantwoordelijk voor de deugdelijke montage van zowel de dakdragers als de dakkoffer. De huurder controleert vóór vertrek en tijdens de reis volgens de gebruiksinstructies of beide correct en veilig vastzitten en de koffer gesloten en vergrendeld is. Bij een losse bevestiging, schade of twijfel wordt niet doorgereden voordat de situatie veilig is hersteld.'),
('Beladen en gebruiken','Volg de voorschriften voor daklast, draagkracht, kofferbelasting, belading, snelheid en extra voertuighoogte. Het gewicht van dragers, koffer en bagage telt mee. De uitleg bij uitgifte vervangt de voertuig- en productinstructies niet.'),
('Schade en wettelijke rechten','Schade door onzorgvuldig of onjuist tillen, monteren, demonteren, beladen of gebruiken door de huurder of diens helpers komt voor rekening van de huurder voor zover die schade aan de huurder kan worden toegerekend. De verhuurder blijft verantwoordelijk voor deugdelijk huurmateriaal en bijbehorende gebruiks- en montage-instructies. Wettelijke aansprakelijkheid van de verhuurder en dwingende consumentenrechten blijven behouden.'),
('Tarief en terugbrengen','Tarieven inclusief btw: EUR 10 per dag, EUR 15 per weekend (vrijdag t/m zondag) of EUR 20 per week (maximaal zeven aaneengesloten dagen). De afgesproken totaalprijs en een eventuele borg staan op pagina 1. Breng de set compleet en op tijd terug. Meld schade, verlies of problemen zo snel mogelijk; gebruik onveilig materiaal niet verder.')
]
for title,text in terms:y=para('<b>'+title+'.</b> '+text,y)
y=section('4. Toelichting en ondertekening',y-2)
y=check('bevestiging_montage','Ik heb gelezen dat ik als huurder zelf de dakdragers en dakkoffer deugdelijk monteer en de bevestiging vóór vertrek en tijdens de reis volgens de gebruiksinstructies controleer.',y)
y=check('bevestiging_instructies','Bij uitgifte: ik heb uitleg en de bijbehorende montage- en gebruiksinstructies ontvangen en de staat en volledigheid met de verhuurder vastgelegd.',y)
y=para('Door ondertekening gaan partijen akkoord met de ingevulde afspraken op pagina 1 en de afspraken op pagina 2. Dit formulier is een invulbaar model; er wordt hiermee geen elektronische handtekening gezet.',y,small)
field('Plaats en datum ondertekening','plaats_datum',LEFT,y,WIDTH);y-=58
c.setStrokeColor(colors.HexColor('#bcb4a4'));c.line(LEFT,y,LEFT+col,y);c.line(LEFT+col+14,y,W-LEFT,y)
c.setFillColor(INK);c.setFont('Helvetica',8);c.drawString(LEFT,y-13,'Handtekening huurder');c.drawString(LEFT+col+14,y-13,'Handtekening verhuurder')
assert y-13>40, f'Handtekeningen buiten pagina: {y}'
c.save()
reader=PdfReader(OUT);assert len(reader.pages)==2
fields=reader.get_fields();assert len(fields)==18,len(fields)
assert fields['bevestiging_montage'].get('/V')=='/Off'
widgets=sum(len(page.get('/Annots',[]))for page in reader.pages);assert widgets==len(fields),(widgets,len(fields))
assert 'deugdelijke montage' in ''.join(p.extract_text() for p in reader.pages)
print(f'Gemaakt: {OUT.name}; 2 pagina’s, {len(fields)} invulvelden, beide bevestigingen leeg.')
