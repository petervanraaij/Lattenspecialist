// Product-specific reference, separated from stock counts and from editable procedures.
const descriptions={
 '25018':'Een opwrijfbare waxstick van 50 gram. Dit is het product voor een snelle glijlaag zonder warm waxijzer; het is niet de Natural Skiwax Bar.',
 '24101':'Een relatief zachte, gele warme glijwax op hydrocarbonbasis. De sneeuwcondities bepalen de keuze; de kleur alleen is geen universele standaard voor andere merken.',
 '24121':'Een harde, blauwe warme glijwax voor koudere en schurende sneeuw. Een hardere wax vraagt een andere verwerking dan de gele wax.',
 '27933':'Een paarse performance-basis- en trainingswax met hoge slijtvastheid en weinig vuilaanhechting. Dit is Performance Bar Purple, niet Performance Bar 21.',
 '24057':'Rode basis- en trainingswax uit de werkplaatsverpakking van vijf blokken van 190 gram. De blokken zijn verbruiksmateriaal; weeg het werkelijk gebruikte blok.',
 '24408':'Transparant vulmateriaal voor kleine, oppervlakkige beschadigingen in geschikt ski- of snowboardbelag. Het is geen wax en geen lijm voor de kern.',
 '24409':'Zwart vulmateriaal voor kleine, oppervlakkige belagreparaties. De kleur past bij zwart belag; de strip herstelt geen losse staalkant of constructie.',
 '25502':'Een elastische houder die de remarmen van een skibinding ingetrokken houdt. Hierdoor blijven remarmen buiten het gebied waar je reinigt, schraapt en borstelt.',
 '20687set':'Een set roterende borstels en toebehoren voor belag- en waxbewerking. Welke borstel je nodig hebt hangt af van de stap; controleer de werkelijke setinhoud vóór gebruik.',
 '20551':'Een leveranciersset voor het verzorgen van staalkanten, met geleiding en bijpassende bewerkingsmiddelen. Bestellijst V3, tab 20551: Racing File M-MINI 25527, Racing File S 25529, Worldcup File Guide 88 graden 24478, klem 24681, Diamond File World Cup medium 24483 en Base Edge File Guide 24686. Controleer bij ontvangst de fysieke set.',
 '25422':'Een reinigingsmiddel voor geschikte ski- en snowboardbelagen. Het maakt vuil en waxresten los; het is geen glijwax en geen middel om de ski mee te smeren.',
 '24491':'Een pluisarm reinigingsvlies op rol. Je gebruikt een schoon stuk als drager voor geschikt reinigingsmiddel en om losgemaakt vuil op te nemen.',
 '20606':'Een neerzetplaat voor het waxijzer. De plaat is de vaste rustplek tussen twee handelingen en geen extra verwarmingsplaat.',
 '24580':'Een elektrisch waxijzer met digitale temperatuurregeling en een zool van 15 mm. Het brengt warmte gecontroleerd over naar de gekozen glijwax.',
 '25631':'Een rechte kunststof schraper van 5 mm voor het verwijderen van afgekoelde overtollige wax. De werkende rand moet recht en scherp zijn.',
 '25635':'Een metalen schraper voor het voorzichtig vlakmaken van geschikte afgekoelde belagreparaties. Hij kan ook het belag zelf wegnemen en is daarom geen gewone waxschraper.',
 '24622':'Een geleide schraperslijper die de rand van een passende kunststof waxschraper weer recht en scherp maakt. Hij slijpt niet de staalkant van een ski.',
 '24498':'Een zijwandschaaf met een snijmes. Hij neemt beperkt kunststof van de zijwand weg wanneer dat het vijlen van de staalkant belemmert.',
 '25521':'Een compacte, grof snijdende metaalvijl voor voorbewerking. Een vijl neemt staal weg; dit is geen polijstborstel of fijne diamantsteen.',
 '25564':'Een kleine borstel voor het schoonmaken van de groeven en tanden van een metaalvijl. Hij hoort bij het vijlen, niet bij het uitborstelen van skiwas.',
 '24684':'Een grove diamantvijl met korrel 200: een drager met een slijpende diamantlaag. Hij verwijdert bramen en grove oneffenheden; hij is niet hetzelfde als een getande metaalvijl.',
 '24432':'Een skiwerkhouder met steun- en klempunten voor een stabiele werkpositie. Hij ondersteunt de ski tijdens belag- en kantenwerk en bepaalt geen slijphoek.',
 '20516':'Een werkhouder voor snowboards en breed materiaal. Hij ondersteunt het materiaal in een geschikte belag- of kantpositie en vervangt geen vijlgeleider.'
};
const wax={
 '24101':{snow:'0 tot -4 °C',iron:'115-125 °C',use:'Voor afgesproken intensieve warme reiniging. Als glijwax: zachte, verse en fijnkorrelige sneeuw.'},
 '24057':{snow:'-4 tot -14 °C',iron:'125-135 °C',use:'Alle sneeuwtypen; basis- en trainingswax. Ook geschikt als transportwax.'},
 '24121':{snow:'-8 tot -20 °C',iron:'135-145 °C',use:'Koude, oude en schurende sneeuw.'},
 '27933':{snow:'0 tot -12 °C',iron:'130-140 °C',use:'Een slijtvaste basis- of trainingslaag met weinig vuilaanhechting.'},
 '25018':{snow:'Alle temperaturen',iron:'Geen waxijzer nodig',use:'Tussendoor de glijlaag bijwerken: opwrijven en polijsten.'}
};
const brushes=[
 {title:'Brons / metaal',what:'Een relatief stevige borstel voor de bedoelde reinigings- en structuurstap.',purpose:'Vuil of waxresten uit de bestaande structuur helpen verwijderen.',how:'Gebruik alleen een geschikte belagborstel, werk met lichte druk en controleer het resultaat. Een vijlborstel hoort niet op het belag.'},
 {title:'Paardenhaar',what:'Een borstel met paardenhaar voor het uitborstelen van wax.',purpose:'Overtollige wax uit de structuur verwijderen na het schrapen.',how:'Werk gelijkmatig in de voorgeschreven richting. Houd een roterende borstel in beweging en volg de snelheid van precies dat model.'},
 {title:'Nylon',what:'Een nylon afwerkborstel voor de bedoelde waxfinish.',purpose:'Losse waxresten verwijderen en de afwerking verzorgen.',how:'Gebruik een schone borstel met weinig druk. Ga niet met extra druk of snelheid warmte op één plek opbouwen.'},
 {title:'Fleece / wol',what:'Een applicator of afwerkrol voor producten die deze verwerking voorschrijven.',purpose:'Het specifiek daarvoor bedoelde finishingproduct verdelen of afwerken.',how:'Gebruik uitsluitend volgens het productvoorschrift. Het is geen universele vervanger voor een borstel die harde wax uit de structuur moet halen.'}
];
const files=[
 {title:'Grove metaalvijl',what:'Een getande vijl die relatief veel staal kan afnemen.',purpose:'Gerichte voorbewerking wanneer die werkelijk nodig is.',how:'Werk met passende geleiding, controleer de snijrichting en neem zo weinig mogelijk materiaal weg. Controleer vaak.'},
 {title:'Fijnere metaalvijl',what:'Een metaalvijl met fijnere vertanding voor een beheerste afwerking.',purpose:'De getoonde voorbewerking gelijkmatiger afwerken.',how:'Gebruik de afgesproken hoek en een geschikte houder. De juiste fijne vijl moet werkelijk beschikbaar zijn.'},
 {title:'Diamantvijl / diamantsteen',what:'Een schurend oppervlak met diamantkorrels, zonder gewone vijltanden.',purpose:'Bramen verwijderen en de kant stapsgewijs afwerken.',how:'Gebruik lichte druk en het voorgeschreven bevochtigingsmiddel. Korrel 200 is grof; 400 of 600 zijn afzonderlijke uitvoeringen en niet automatisch aanwezig.'}
];
export function materialExplanation(sku){const info=wax[sku];return {what:descriptions[sku]||'',...(info?{goal:info.use,settings:[{label:'Sneeuwtemperatuur',value:info.snow},{label:'Waxijzer',value:info.iron}],settingNote:'Sneeuw is niet de luchttemperatuur. Gegevens: HOLMENKOL 2026/27; het etiket van de exacte uitvoering gaat voor.'}:{}),...(sku==='20687set'?{variants:brushes,variantNote:'Bestellijst V3 tab 20687set: Bronze 24674, Horsehair 24672, Nylon 24671, houder 20685, bescherming 20686 en koffer 24694. Fleece/wol is uitleg over een aparte uitvoering. Setonderdelen worden niet dubbel als losse voorraad bijgeboekt.'}:{}),...(['20551','25521','24684'].includes(sku)?{variants:files,variantNote:'Functie-uitleg: niet iedere genoemde uitvoering is aangeschaft. Controleer de voorraad en het exacte artikel.'}:{})};}
export const explainedMaterialSkus=Object.keys(descriptions);
