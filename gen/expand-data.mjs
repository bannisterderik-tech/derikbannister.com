#!/usr/bin/env node
/* DB— data source of truth.
   Compact pipe-delimited tables in, data/*.json out. Run: node gen/expand-data.mjs
   Then: node gen/build.mjs
   Edit HERE, never the JSON — the JSON is generated. */
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { answers, answerCategories } from './answers-src.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = (f, v) => writeFileSync(join(ROOT, 'data', f), JSON.stringify(v, null, 1) + '\n');

const STATE_NAME = { OR: 'Oregon', WA: 'Washington', CA: 'California', ID: 'Idaho', NV: 'Nevada' };

/* ============================== LOCATIONS ==============================
   slug | City | ST | County | region | tier | nearby;nearby;nearby;nearby;nearby
   tier 1 = anchor metro (gets every core service page)
   tier 2 = surrounding market (gets the top service pages)
   Counties and neighbors are real. Nothing here is invented. */
const LOC = `
portland|Portland|OR|Multnomah County|Portland metro|1|Beaverton;Gresham;Lake Oswego;Tigard;Milwaukie
salem|Salem|OR|Marion County|mid-Willamette Valley|1|Keizer;Woodburn;Silverton;Dallas;Independence
eugene|Eugene|OR|Lane County|southern Willamette Valley|1|Springfield;Junction City;Creswell;Veneta;Cottage Grove
springfield|Springfield|OR|Lane County|southern Willamette Valley|1|Eugene;Coburg;Creswell;Junction City;Pleasant Hill
gresham|Gresham|OR|Multnomah County|east Portland metro|1|Portland;Troutdale;Fairview;Happy Valley;Sandy
hillsboro|Hillsboro|OR|Washington County|west Portland metro|1|Beaverton;Forest Grove;Cornelius;Aloha;Tigard
beaverton|Beaverton|OR|Washington County|west Portland metro|1|Portland;Hillsboro;Tigard;Aloha;Tualatin
bend|Bend|OR|Deschutes County|Central Oregon|1|Redmond;Sisters;Sunriver;Prineville;La Pine
medford|Medford|OR|Jackson County|Rogue Valley|1|Ashland;Central Point;Jacksonville;Talent;Phoenix
corvallis|Corvallis|OR|Benton County|mid-Willamette Valley|1|Albany;Philomath;Lebanon;Monmouth;Independence
albany|Albany|OR|Linn County|mid-Willamette Valley|1|Corvallis;Lebanon;Tangent;Millersburg;Jefferson
tigard|Tigard|OR|Washington County|southwest Portland metro|1|Beaverton;Tualatin;Lake Oswego;Sherwood;King City
lake-oswego|Lake Oswego|OR|Clackamas County|south Portland metro|1|Portland;West Linn;Tigard;Milwaukie;Tualatin
grants-pass|Grants Pass|OR|Josephine County|Rogue Valley|1|Medford;Cave Junction;Rogue River;Merlin;Central Point
keizer|Keizer|OR|Marion County|mid-Willamette Valley|2|Salem;Woodburn;Silverton;Brooks;Gervais
oregon-city|Oregon City|OR|Clackamas County|south Portland metro|2|West Linn;Gladstone;Canby;Milwaukie;Happy Valley
mcminnville|McMinnville|OR|Yamhill County|Yamhill Valley wine country|2|Newberg;Dayton;Lafayette;Carlton;Amity
redmond|Redmond|OR|Deschutes County|Central Oregon|2|Bend;Sisters;Terrebonne;Prineville;Madras
tualatin|Tualatin|OR|Washington County|southwest Portland metro|2|Tigard;Sherwood;Wilsonville;Lake Oswego;Durham
west-linn|West Linn|OR|Clackamas County|south Portland metro|2|Lake Oswego;Oregon City;Wilsonville;Tualatin;Gladstone
woodburn|Woodburn|OR|Marion County|north Willamette Valley|2|Salem;Keizer;Hubbard;Gervais;Canby
newberg|Newberg|OR|Yamhill County|Chehalem Valley|2|Dundee;McMinnville;Sherwood;Wilsonville;Yamhill
roseburg|Roseburg|OR|Douglas County|Umpqua Valley|2|Sutherlin;Winston;Myrtle Creek;Green;Oakland
klamath-falls|Klamath Falls|OR|Klamath County|Klamath Basin|2|Altamont;Chiloquin;Merrill;Bonanza;Malin
ashland|Ashland|OR|Jackson County|Rogue Valley|2|Medford;Talent;Phoenix;Jacksonville;Central Point
wilsonville|Wilsonville|OR|Clackamas County|south Portland metro|2|Tualatin;Sherwood;Canby;West Linn;Newberg
sherwood|Sherwood|OR|Washington County|southwest Portland metro|2|Tualatin;Tigard;Newberg;Wilsonville;King City
canby|Canby|OR|Clackamas County|north Willamette Valley|2|Oregon City;Wilsonville;Molalla;Aurora;Hubbard
lebanon|Lebanon|OR|Linn County|mid-Willamette Valley|2|Albany;Sweet Home;Corvallis;Brownsville;Scio
astoria|Astoria|OR|Clatsop County|north Oregon coast|2|Warrenton;Seaside;Gearhart;Knappa;Cannon Beach
newport|Newport|OR|Lincoln County|central Oregon coast|2|Toledo;Waldport;Depoe Bay;Lincoln City;Siletz
coos-bay|Coos Bay|OR|Coos County|south Oregon coast|2|North Bend;Bandon;Charleston;Coquille;Reedsport
the-dalles|The Dalles|OR|Wasco County|Columbia River Gorge|2|Hood River;Dufur;Mosier;Maupin;Goldendale
hood-river|Hood River|OR|Hood River County|Columbia River Gorge|2|The Dalles;Odell;Parkdale;Cascade Locks;White Salmon
pendleton|Pendleton|OR|Umatilla County|eastern Oregon|2|Hermiston;Athena;Milton-Freewater;Echo;Adams
hermiston|Hermiston|OR|Umatilla County|Columbia Basin|2|Pendleton;Umatilla;Boardman;Stanfield;Echo
la-grande|La Grande|OR|Union County|Grande Ronde Valley|2|Island City;Union;Elgin;Cove;Baker City
ontario|Ontario|OR|Malheur County|western Treasure Valley|2|Nyssa;Vale;Fruitland;Payette;Weiser
baker-city|Baker City|OR|Baker County|eastern Oregon|2|Haines;Halfway;La Grande;Sumpter;Huntington
prineville|Prineville|OR|Crook County|Central Oregon|2|Redmond;Bend;Madras;Powell Butte;Terrebonne
milwaukie|Milwaukie|OR|Clackamas County|south Portland metro|2|Portland;Oak Grove;Gladstone;Happy Valley;Lake Oswego
happy-valley|Happy Valley|OR|Clackamas County|east Portland metro|2|Portland;Gresham;Damascus;Milwaukie;Clackamas
forest-grove|Forest Grove|OR|Washington County|west Portland metro|2|Cornelius;Hillsboro;Gaston;Banks;Beaverton
troutdale|Troutdale|OR|Multnomah County|east Portland metro|2|Gresham;Fairview;Wood Village;Corbett;Portland
sandy|Sandy|OR|Clackamas County|east Portland metro|2|Gresham;Estacada;Boring;Welches;Damascus
molalla|Molalla|OR|Clackamas County|north Willamette Valley|2|Canby;Oregon City;Colton;Mulino;Silverton
silverton|Silverton|OR|Marion County|mid-Willamette Valley|2|Salem;Mount Angel;Stayton;Woodburn;Scotts Mills
stayton|Stayton|OR|Marion County|mid-Willamette Valley|2|Sublimity;Salem;Aumsville;Silverton;Mill City
dallas|Dallas|OR|Polk County|mid-Willamette Valley|2|Salem;Monmouth;Independence;Rickreall;Falls City
monmouth|Monmouth|OR|Polk County|mid-Willamette Valley|2|Independence;Dallas;Salem;Rickreall;Corvallis
independence|Independence|OR|Polk County|mid-Willamette Valley|2|Monmouth;Dallas;Salem;Rickreall;Albany
cottage-grove|Cottage Grove|OR|Lane County|southern Willamette Valley|2|Creswell;Eugene;Drain;Dorena;Springfield
creswell|Creswell|OR|Lane County|southern Willamette Valley|2|Eugene;Cottage Grove;Springfield;Goshen;Pleasant Hill
junction-city|Junction City|OR|Lane County|southern Willamette Valley|2|Eugene;Harrisburg;Monroe;Halsey;Veneta
veneta|Veneta|OR|Lane County|southern Willamette Valley|2|Eugene;Elmira;Junction City;Noti;Crow
florence|Florence|OR|Lane County|central Oregon coast|2|Mapleton;Reedsport;Yachats;Dunes City;Waldport
lincoln-city|Lincoln City|OR|Lincoln County|central Oregon coast|2|Depoe Bay;Newport;Otis;Neotsu;Gleneden Beach
seaside|Seaside|OR|Clatsop County|north Oregon coast|2|Gearhart;Cannon Beach;Astoria;Warrenton;Manzanita
tillamook|Tillamook|OR|Tillamook County|north Oregon coast|2|Bay City;Garibaldi;Netarts;Rockaway Beach;Pacific City
sisters|Sisters|OR|Deschutes County|Central Oregon|2|Bend;Redmond;Camp Sherman;Terrebonne;Tumalo
madras|Madras|OR|Jefferson County|Central Oregon|2|Culver;Metolius;Redmond;Warm Springs;Prineville
sweet-home|Sweet Home|OR|Linn County|mid-Willamette Valley|2|Lebanon;Brownsville;Foster;Albany;Cascadia
sutherlin|Sutherlin|OR|Douglas County|Umpqua Valley|2|Roseburg;Oakland;Wilbur;Winchester;Elkton
brookings|Brookings|OR|Curry County|south Oregon coast|2|Harbor;Gold Beach;Smith River;Port Orford;Crescent City
central-point|Central Point|OR|Jackson County|Rogue Valley|2|Medford;Jacksonville;Eagle Point;Gold Hill;White City
seattle|Seattle|WA|King County|Puget Sound|1|Bellevue;Renton;Shoreline;Burien;Kent
spokane|Spokane|WA|Spokane County|Inland Northwest|1|Spokane Valley;Liberty Lake;Cheney;Airway Heights;Deer Park
tacoma|Tacoma|WA|Pierce County|South Sound|1|Lakewood;Puyallup;Federal Way;University Place;Gig Harbor
vancouver|Vancouver|WA|Clark County|southwest Washington|1|Camas;Battle Ground;Ridgefield;Washougal;Hazel Dell
bellevue|Bellevue|WA|King County|Eastside|1|Kirkland;Redmond;Issaquah;Renton;Sammamish
kent|Kent|WA|King County|South King County|1|Renton;Auburn;Federal Way;Covington;Tukwila
everett|Everett|WA|Snohomish County|north Puget Sound|1|Marysville;Lynnwood;Mukilteo;Mill Creek;Snohomish
renton|Renton|WA|King County|South King County|1|Kent;Bellevue;Tukwila;Newcastle;Seattle
yakima|Yakima|WA|Yakima County|Yakima Valley|1|Union Gap;Selah;Moxee;Naches;Sunnyside
bellingham|Bellingham|WA|Whatcom County|north Puget Sound|1|Ferndale;Lynden;Blaine;Everson;Bellingham Bay
kennewick|Kennewick|WA|Benton County|Tri-Cities|1|Richland;Pasco;West Richland;Finley;Burbank
olympia|Olympia|WA|Thurston County|South Sound|1|Lacey;Tumwater;Yelm;Shelton;Rochester
federal-way|Federal Way|WA|King County|South King County|2|Kent;Auburn;Des Moines;Tacoma;Milton
spokane-valley|Spokane Valley|WA|Spokane County|Inland Northwest|2|Spokane;Liberty Lake;Millwood;Otis Orchards;Greenacres
kirkland|Kirkland|WA|King County|Eastside|2|Bellevue;Redmond;Bothell;Woodinville;Kenmore
auburn|Auburn|WA|King County|South King County|2|Kent;Federal Way;Sumner;Pacific;Algona
pasco|Pasco|WA|Franklin County|Tri-Cities|2|Kennewick;Richland;Burbank;Connell;West Pasco
richland|Richland|WA|Benton County|Tri-Cities|2|Kennewick;Pasco;West Richland;Benton City;Finley
marysville|Marysville|WA|Snohomish County|north Puget Sound|2|Everett;Arlington;Lake Stevens;Tulalip;Smokey Point
lakewood|Lakewood|WA|Pierce County|South Sound|2|Tacoma;University Place;Steilacoom;DuPont;Parkland
redmond-wa|Redmond|WA|King County|Eastside|2|Bellevue;Kirkland;Sammamish;Woodinville;Duvall
lacey|Lacey|WA|Thurston County|South Sound|2|Olympia;Tumwater;Yelm;DuPont;Rainier
puyallup|Puyallup|WA|Pierce County|South Sound|2|Sumner;Tacoma;Bonney Lake;Orting;Graham
edmonds|Edmonds|WA|Snohomish County|north Puget Sound|2|Lynnwood;Mountlake Terrace;Mukilteo;Shoreline;Brier
bremerton|Bremerton|WA|Kitsap County|Kitsap Peninsula|2|Silverdale;Port Orchard;Poulsbo;Bainbridge Island;Gorst
longview|Longview|WA|Cowlitz County|southwest Washington|2|Kelso;Castle Rock;Woodland;Kalama;Rainier
wenatchee|Wenatchee|WA|Chelan County|north central Washington|2|East Wenatchee;Cashmere;Leavenworth;Chelan;Rock Island
mount-vernon|Mount Vernon|WA|Skagit County|Skagit Valley|2|Burlington;Sedro-Woolley;Anacortes;La Conner;Stanwood
walla-walla|Walla Walla|WA|Walla Walla County|Walla Walla Valley|2|College Place;Milton-Freewater;Waitsburg;Dayton;Touchet
pullman|Pullman|WA|Whitman County|the Palouse|2|Colfax;Moscow;Albion;Palouse;Rosalia
aberdeen|Aberdeen|WA|Grays Harbor County|Washington coast|2|Hoquiam;Cosmopolis;Montesano;Ocean Shores;Elma
port-angeles|Port Angeles|WA|Clallam County|Olympic Peninsula|2|Sequim;Forks;Port Townsend;Joyce;Carlsborg
ellensburg|Ellensburg|WA|Kittitas County|Kittitas Valley|2|Cle Elum;Kittitas;Thorp;Roslyn;Selah
moses-lake|Moses Lake|WA|Grant County|Columbia Basin|2|Ephrata;Othello;Quincy;Warden;Soap Lake
centralia|Centralia|WA|Lewis County|southwest Washington|2|Chehalis;Napavine;Winlock;Tenino;Rochester
camas|Camas|WA|Clark County|southwest Washington|2|Washougal;Vancouver;Battle Ground;Ridgefield;Brush Prairie
battle-ground|Battle Ground|WA|Clark County|southwest Washington|2|Vancouver;Ridgefield;Camas;La Center;Brush Prairie
issaquah|Issaquah|WA|King County|Eastside|2|Sammamish;Bellevue;Renton;Newcastle;Snoqualmie
bothell|Bothell|WA|Snohomish County|north Puget Sound|2|Kirkland;Woodinville;Mill Creek;Kenmore;Lynnwood
lynnwood|Lynnwood|WA|Snohomish County|north Puget Sound|2|Edmonds;Everett;Mountlake Terrace;Mill Creek;Bothell
sammamish|Sammamish|WA|King County|Eastside|2|Issaquah;Redmond;Bellevue;Snoqualmie;Duvall
burien|Burien|WA|King County|South King County|2|Tukwila;SeaTac;Des Moines;Normandy Park;White Center
shoreline|Shoreline|WA|King County|north Seattle|2|Seattle;Edmonds;Lake Forest Park;Mountlake Terrace;Kenmore
gig-harbor|Gig Harbor|WA|Pierce County|Kitsap Peninsula|2|Tacoma;Port Orchard;Purdy;Fox Island;Key Center
port-orchard|Port Orchard|WA|Kitsap County|Kitsap Peninsula|2|Bremerton;Gig Harbor;Silverdale;Belfair;Southworth
anacortes|Anacortes|WA|Skagit County|Skagit Valley|2|Mount Vernon;Burlington;Oak Harbor;La Conner;Sedro-Woolley
oak-harbor|Oak Harbor|WA|Island County|Whidbey Island|2|Coupeville;Anacortes;Freeland;Clinton;Langley
los-angeles|Los Angeles|CA|Los Angeles County|Greater Los Angeles|1|Glendale;Pasadena;Burbank;Inglewood;Santa Monica
san-diego|San Diego|CA|San Diego County|San Diego County|1|Chula Vista;El Cajon;La Mesa;Poway;Santee
san-jose|San Jose|CA|Santa Clara County|Silicon Valley|1|Santa Clara;Sunnyvale;Milpitas;Campbell;Cupertino
san-francisco|San Francisco|CA|San Francisco County|San Francisco Bay Area|1|Daly City;South San Francisco;Oakland;Brisbane;Sausalito
fresno|Fresno|CA|Fresno County|Central Valley|1|Clovis;Sanger;Selma;Kerman;Fowler
sacramento|Sacramento|CA|Sacramento County|Sacramento Valley|1|Elk Grove;Citrus Heights;Rancho Cordova;Folsom;West Sacramento
long-beach|Long Beach|CA|Los Angeles County|South Bay|1|Lakewood;Signal Hill;Carson;Seal Beach;Los Alamitos
oakland|Oakland|CA|Alameda County|East Bay|1|Berkeley;Alameda;Emeryville;San Leandro;Piedmont
bakersfield|Bakersfield|CA|Kern County|southern Central Valley|1|Delano;Shafter;Wasco;Taft;Arvin
anaheim|Anaheim|CA|Orange County|Orange County|1|Fullerton;Orange;Garden Grove;Buena Park;Placentia
santa-ana|Santa Ana|CA|Orange County|Orange County|1|Tustin;Orange;Costa Mesa;Garden Grove;Irvine
riverside|Riverside|CA|Riverside County|Inland Empire|1|Moreno Valley;Corona;Jurupa Valley;Norco;Perris
stockton|Stockton|CA|San Joaquin County|Central Valley|1|Lodi;Manteca;Tracy;Lathrop;Ripon
irvine|Irvine|CA|Orange County|Orange County|1|Tustin;Lake Forest;Costa Mesa;Newport Beach;Laguna Hills
fremont|Fremont|CA|Alameda County|East Bay|1|Newark;Union City;Milpitas;Hayward;Sunol
san-bernardino|San Bernardino|CA|San Bernardino County|Inland Empire|1|Rialto;Colton;Highland;Redlands;Loma Linda
modesto|Modesto|CA|Stanislaus County|Central Valley|1|Turlock;Ceres;Riverbank;Oakdale;Salida
oxnard|Oxnard|CA|Ventura County|Ventura County|1|Ventura;Camarillo;Port Hueneme;Santa Paula;Thousand Oaks
santa-rosa|Santa Rosa|CA|Sonoma County|Sonoma County|1|Rohnert Park;Windsor;Sebastopol;Petaluma;Healdsburg
santa-barbara|Santa Barbara|CA|Santa Barbara County|Santa Barbara County|1|Goleta;Carpinteria;Montecito;Isla Vista;Summerland
redding-ca|Redding|CA|Shasta County|far northern California|1|Anderson;Shasta Lake;Palo Cedro;Cottonwood;Red Bluff
chula-vista|Chula Vista|CA|San Diego County|South Bay San Diego|2|San Diego;National City;Imperial Beach;Bonita;Otay Mesa
fontana|Fontana|CA|San Bernardino County|Inland Empire|2|Rialto;Rancho Cucamonga;Ontario;Bloomington;Colton
moreno-valley|Moreno Valley|CA|Riverside County|Inland Empire|2|Riverside;Perris;Beaumont;March Air Reserve Base;Sunnymead
huntington-beach|Huntington Beach|CA|Orange County|Orange County|2|Costa Mesa;Fountain Valley;Westminster;Seal Beach;Newport Beach
glendale-ca|Glendale|CA|Los Angeles County|Greater Los Angeles|2|Burbank;Pasadena;La Cañada Flintridge;Los Angeles;Eagle Rock
santa-clarita|Santa Clarita|CA|Los Angeles County|Santa Clarita Valley|2|Valencia;Newhall;Castaic;Stevenson Ranch;Palmdale
garden-grove|Garden Grove|CA|Orange County|Orange County|2|Westminster;Santa Ana;Anaheim;Stanton;Fountain Valley
oceanside|Oceanside|CA|San Diego County|North County San Diego|2|Carlsbad;Vista;San Marcos;Fallbrook;Encinitas
rancho-cucamonga|Rancho Cucamonga|CA|San Bernardino County|Inland Empire|2|Ontario;Upland;Fontana;Claremont;Alta Loma
ontario-ca|Ontario|CA|San Bernardino County|Inland Empire|2|Rancho Cucamonga;Chino;Upland;Fontana;Pomona
elk-grove|Elk Grove|CA|Sacramento County|Sacramento Valley|2|Sacramento;Galt;Wilton;Rancho Murieta;Laguna
corona|Corona|CA|Riverside County|Inland Empire|2|Norco;Riverside;Eastvale;Chino Hills;Lake Elsinore
lancaster-ca|Lancaster|CA|Los Angeles County|Antelope Valley|2|Palmdale;Quartz Hill;Rosamond;Littlerock;Mojave
palmdale|Palmdale|CA|Los Angeles County|Antelope Valley|2|Lancaster;Quartz Hill;Acton;Littlerock;Santa Clarita
salinas|Salinas|CA|Monterey County|Salinas Valley|2|Monterey;Marina;Seaside;Gonzales;Castroville
hayward|Hayward|CA|Alameda County|East Bay|2|Union City;San Leandro;Castro Valley;Fremont;San Lorenzo
escondido|Escondido|CA|San Diego County|North County San Diego|2|San Marcos;Vista;Poway;Valley Center;Rancho Bernardo
sunnyvale|Sunnyvale|CA|Santa Clara County|Silicon Valley|2|Mountain View;Santa Clara;Cupertino;San Jose;Los Altos
torrance|Torrance|CA|Los Angeles County|South Bay|2|Redondo Beach;Gardena;Carson;Lomita;Palos Verdes Estates
pasadena-ca|Pasadena|CA|Los Angeles County|San Gabriel Valley|2|Altadena;Arcadia;South Pasadena;Glendale;Sierra Madre
fullerton|Fullerton|CA|Orange County|Orange County|2|Anaheim;Brea;Placentia;Buena Park;La Habra
roseville|Roseville|CA|Placer County|Sacramento Valley|2|Rocklin;Citrus Heights;Granite Bay;Lincoln;Antelope
visalia|Visalia|CA|Tulare County|Central Valley|2|Tulare;Exeter;Farmersville;Goshen;Dinuba
concord|Concord|CA|Contra Costa County|East Bay|2|Walnut Creek;Pleasant Hill;Martinez;Clayton;Pittsburg
thousand-oaks|Thousand Oaks|CA|Ventura County|Conejo Valley|2|Newbury Park;Westlake Village;Simi Valley;Agoura Hills;Camarillo
simi-valley|Simi Valley|CA|Ventura County|Ventura County|2|Thousand Oaks;Moorpark;Chatsworth;Camarillo;Agoura Hills
santa-clara-ca|Santa Clara|CA|Santa Clara County|Silicon Valley|2|San Jose;Sunnyvale;Cupertino;Campbell;Milpitas
victorville|Victorville|CA|San Bernardino County|Victor Valley|2|Hesperia;Apple Valley;Adelanto;Barstow;Phelan
vallejo|Vallejo|CA|Solano County|North Bay|2|Benicia;American Canyon;Fairfield;Martinez;Napa
berkeley|Berkeley|CA|Alameda County|East Bay|2|Oakland;Albany;Emeryville;El Cerrito;Kensington
fairfield-ca|Fairfield|CA|Solano County|North Bay|2|Suisun City;Vacaville;Vallejo;Benicia;Cordelia
murrieta|Murrieta|CA|Riverside County|southwest Riverside County|2|Temecula;Menifee;Wildomar;Lake Elsinore;Winchester
temecula|Temecula|CA|Riverside County|southwest Riverside County|2|Murrieta;Menifee;Wildomar;Fallbrook;Winchester
antioch|Antioch|CA|Contra Costa County|East Bay|2|Pittsburg;Oakley;Brentwood;Bay Point;Concord
richmond-ca|Richmond|CA|Contra Costa County|East Bay|2|El Cerrito;San Pablo;Pinole;Albany;Berkeley
ventura|Ventura|CA|Ventura County|Ventura County|2|Oxnard;Ojai;Camarillo;Santa Paula;Carpinteria
chico|Chico|CA|Butte County|northern Sacramento Valley|2|Paradise;Oroville;Durham;Magalia;Corning
eureka|Eureka|CA|Humboldt County|Humboldt County|2|Arcata;McKinleyville;Fortuna;Ferndale;Blue Lake
napa|Napa|CA|Napa County|Napa Valley|2|American Canyon;Yountville;St. Helena;Vallejo;Sonoma
san-luis-obispo|San Luis Obispo|CA|San Luis Obispo County|Central Coast|2|Pismo Beach;Arroyo Grande;Morro Bay;Atascadero;Los Osos
palm-springs|Palm Springs|CA|Riverside County|Coachella Valley|2|Cathedral City;Palm Desert;Rancho Mirage;Desert Hot Springs;La Quinta
merced|Merced|CA|Merced County|Central Valley|2|Atwater;Livingston;Los Banos;Winton;Planada
turlock|Turlock|CA|Stanislaus County|Central Valley|2|Modesto;Ceres;Denair;Hughson;Delhi
tracy|Tracy|CA|San Joaquin County|Central Valley|2|Mountain House;Manteca;Lathrop;Livermore;Banta
folsom|Folsom|CA|Sacramento County|Sacramento Valley|2|El Dorado Hills;Rancho Cordova;Granite Bay;Orangevale;Roseville
redwood-city|Redwood City|CA|San Mateo County|the Peninsula|2|San Carlos;Menlo Park;Atherton;Palo Alto;Belmont
san-mateo|San Mateo|CA|San Mateo County|the Peninsula|2|Burlingame;Foster City;Belmont;Hillsborough;San Carlos
mountain-view|Mountain View|CA|Santa Clara County|Silicon Valley|2|Palo Alto;Sunnyvale;Los Altos;Santa Clara;Menlo Park
livermore|Livermore|CA|Alameda County|Tri-Valley|2|Pleasanton;Dublin;San Ramon;Tracy;Sunol
pleasanton|Pleasanton|CA|Alameda County|Tri-Valley|2|Dublin;Livermore;San Ramon;Danville;Sunol
walnut-creek|Walnut Creek|CA|Contra Costa County|East Bay|2|Concord;Lafayette;Pleasant Hill;Danville;Alamo
carlsbad|Carlsbad|CA|San Diego County|North County San Diego|2|Oceanside;Vista;Encinitas;San Marcos;Del Mar
el-cajon|El Cajon|CA|San Diego County|East County San Diego|2|La Mesa;Santee;Lakeside;Spring Valley;Alpine
clovis|Clovis|CA|Fresno County|Central Valley|2|Fresno;Sanger;Madera;Friant;Kingsburg
santa-cruz|Santa Cruz|CA|Santa Cruz County|Monterey Bay|2|Capitola;Scotts Valley;Aptos;Watsonville;Soquel
monterey|Monterey|CA|Monterey County|Monterey Bay|2|Seaside;Pacific Grove;Carmel-by-the-Sea;Marina;Salinas
paso-robles|Paso Robles|CA|San Luis Obispo County|Central Coast|2|Atascadero;Templeton;San Miguel;Creston;San Luis Obispo
santa-maria|Santa Maria|CA|Santa Barbara County|Central Coast|2|Orcutt;Lompoc;Guadalupe;Nipomo;Buellton
vacaville|Vacaville|CA|Solano County|North Bay|2|Fairfield;Dixon;Winters;Suisun City;Elmira
petaluma|Petaluma|CA|Sonoma County|Sonoma County|2|Rohnert Park;Novato;Cotati;Penngrove;Sonoma
san-rafael|San Rafael|CA|Marin County|North Bay|2|Novato;Larkspur;Corte Madera;San Anselmo;Mill Valley
gilroy|Gilroy|CA|Santa Clara County|south Santa Clara Valley|2|Morgan Hill;San Martin;Hollister;Watsonville;San Jose
lodi|Lodi|CA|San Joaquin County|Central Valley|2|Stockton;Galt;Woodbridge;Acampo;Lockeford
manteca|Manteca|CA|San Joaquin County|Central Valley|2|Lathrop;Ripon;Stockton;Tracy;Escalon
davis|Davis|CA|Yolo County|Sacramento Valley|2|Woodland;West Sacramento;Dixon;Winters;Sacramento
hemet|Hemet|CA|Riverside County|San Jacinto Valley|2|San Jacinto;Menifee;Perris;Winchester;Idyllwild
indio|Indio|CA|Riverside County|Coachella Valley|2|La Quinta;Coachella;Palm Desert;Bermuda Dunes;Thermal
boise|Boise|ID|Ada County|Treasure Valley|1|Meridian;Eagle;Garden City;Kuna;Star
meridian-id|Meridian|ID|Ada County|Treasure Valley|2|Boise;Eagle;Kuna;Star;Nampa
nampa-id|Nampa|ID|Canyon County|Treasure Valley|2|Caldwell;Meridian;Kuna;Middleton;Melba
caldwell-id|Caldwell|ID|Canyon County|Treasure Valley|2|Nampa;Middleton;Parma;Notus;Wilder
coeur-dalene-id|Coeur d'Alene|ID|Kootenai County|Inland Northwest|2|Post Falls;Hayden;Rathdrum;Spokane Valley;Liberty Lake
post-falls-id|Post Falls|ID|Kootenai County|Inland Northwest|2|Coeur d'Alene;Hayden;Rathdrum;Liberty Lake;Spokane Valley
reno|Reno|NV|Washoe County|Truckee Meadows|1|Sparks;Carson City;Sun Valley;Verdi;Cold Springs
sparks-nv|Sparks|NV|Washoe County|Truckee Meadows|2|Reno;Sun Valley;Spanish Springs;Fernley;Carson City
carson-city-nv|Carson City|NV|Carson City|Carson Valley|2|Minden;Gardnerville;Dayton;Reno;Genoa
las-vegas-nv|Las Vegas|NV|Clark County|Las Vegas Valley|1|Henderson;North Las Vegas;Summerlin;Paradise;Spring Valley
henderson-nv|Henderson|NV|Clark County|Las Vegas Valley|2|Las Vegas;Boulder City;Paradise;Anthem;Green Valley
north-las-vegas-nv|North Las Vegas|NV|Clark County|Las Vegas Valley|2|Las Vegas;Henderson;Summerlin;Nellis AFB;Sunrise Manor
`;

/* Slug convention is {city}-{state}, always — it is what the live site already uses
   (/locations/portland-or/), it can never collide across states, and changing it would
   404 every URL Google has already indexed. The table's first column is the base; the
   state suffix is appended here whether or not the base already carries it. */
const locations = LOC.trim().split('\n').map(line => {
  const [base, city, state, county, region, tier, nearby] = line.split('|');
  const st = state.toLowerCase();
  const slug = `${base.replace(new RegExp(`-${st}$`), '')}-${st}`;
  return { slug, city, state, stateName: STATE_NAME[state], county, region, tier: +tier, nearby: nearby.split(';') };
});

/* ============================== TRADES ==============================
   slug | Name | plural | category | pain | trade-specific systems */
const TRD = `
roofing|Roofing|roofing companies|exterior|storm-season call surges, insurance-job paperwork, and estimates that die without follow-up|storm-response landing pages, financing calculators, drone-photo galleries, and automated estimate follow-up
plumbing|Plumbing|plumbing companies|mechanical|emergency calls at 2am, dispatch chaos, and price-shoppers who never call back|24/7 AI call answering, emergency-plumber landing pages, upfront-pricing tables, and membership-plan signup flows
hvac|HVAC|HVAC companies|mechanical|brutal seasonal swings, maintenance plans nobody renews, and tune-up leads that go cold|seasonal demand campaigns, maintenance-plan portals, financing integrations, and automated tune-up reminders
electrical|Electrical|electricians|mechanical|permit-heavy jobs, panel-upgrade shoppers, and quotes that sit unanswered|panel-upgrade and EV-charger landing pages, permit-tracking tools, and quote follow-up automation
solar|Solar|solar installers|exterior|long sales cycles, incentive confusion, and leads that stall between quote and contract|savings calculators, incentive-explainer pages, proposal portals, and long-cycle nurture sequences
concrete|Concrete|concrete contractors|site-work|weather-dependent scheduling, square-foot price shoppers, and bid requests with no drawings|instant square-foot estimators, project galleries by pour type, and weather-aware scheduling notices
landscaping|Landscaping|landscaping companies|outdoor-living|seasonal revenue cliffs, one-off customers, and maintenance contracts that churn|recurring-maintenance signup flows, seasonal service campaigns, and design-gallery lead magnets
pest-control|Pest Control|pest control companies|specialty|recurring-plan churn, same-day service demands, and pest-specific search traffic|pest-by-species landing pages, recurring-plan billing, same-day booking, and reactivation campaigns
garage-doors|Garage Doors|garage door companies|exterior|broken-spring emergencies, brand-model confusion, and same-day dispatch pressure|emergency-repair landing pages, door-style visualizers, brand/model pages, and same-day booking
painting|Painting|painting contractors|interior|estimate-heavy sales, color-decision delays, and seasonal exterior windows|color-visualizer galleries, per-room estimate tools, and interior/exterior seasonal campaigns
remodeling|Remodeling|remodeling contractors|interior|long consideration cycles, budget-mismatched leads, and portfolio-driven buying|project-cost range guides, before/after galleries, financing calculators, and long-cycle nurture
fencing|Fencing|fence companies|outdoor-living|linear-foot price shoppers, property-line questions, and material confusion|linear-foot estimators, material-comparison pages (cedar, vinyl, chain link, ornamental), and HOA-spec guides
excavation|Excavation|excavation contractors|site-work|bid-based work, equipment scheduling, and permit timelines|equipment-capability pages, site-prep project galleries, and bid-request intake forms
tree-service|Tree Service|tree service companies|outdoor-living|storm-emergency spikes, hazard-tree urgency, and insurance claims|storm-response pages, emergency dispatch answering, hazard-assessment intake, and ISA-credential trust blocks
flooring|Flooring|flooring companies|interior|material sampling, square-foot comparison, and installers vs. big-box competition|material-by-room pages, square-foot estimators, sample-request flows, and installed-price comparison
gutters|Gutters|gutter companies|exterior|rainy-season demand spikes, guard upsells, and low-ticket job economics|seasonal gutter-cleaning campaigns, guard-comparison pages, and route-based service scheduling
construction|Construction|general contractors|site-work|long bid cycles, subcontractor coordination, and referral dependence|project-portfolio pages by build type, bid-intake systems, and client-update portals
real-estate|Real Estate|real estate teams|specialty|lead-source fragmentation, slow speed-to-lead, and database neglect|IDX-adjacent landing pages, instant-response lead routing, and past-client reactivation campaigns
pools-spas|Pools & Spas|pool builders and service companies|outdoor-living|long build cycles, seasonal service demand, and weekly-route economics|build-cost range guides, design galleries, weekly-service signup flows, and off-season maintenance campaigns
decks|Decks & Patios|deck builders|outdoor-living|material comparison, permit questions, and spring booking crunches|composite-vs-wood comparison pages, square-foot estimators, and spring pre-booking campaigns
masonry|Masonry|masonry contractors|exterior|custom bids, material sourcing, and long project timelines|stonework portfolio galleries by material, custom-bid intake, and project-timeline explainers
pressure-washing|Pressure Washing|pressure washing companies|cleaning|low-ticket jobs, route density, and seasonal demand|surface-type service pages, bundled-package pricing, route-based booking, and annual reminder campaigns
septic|Septic|septic companies|site-work|emergency pumping calls, county permit rules, and inspection deadlines|emergency dispatch answering, county-permit explainer pages, and pumping-interval reminder automation
well-water|Well & Water Systems|well drilling and water treatment companies|site-work|rural service areas, water-quality questions, and emergency pump failures|water-test intake forms, county-by-county service pages, and emergency pump-repair dispatch
foundation-repair|Foundation Repair|foundation repair contractors|site-work|fear-driven buyers, engineer reports, and high-ticket approval cycles|inspection-request flows, problem-symptom pages, warranty explainers, and financing integration
insulation|Insulation|insulation contractors|interior|rebate paperwork, seasonal demand, and invisible-product selling|rebate-and-incentive pages, energy-savings calculators, and seasonal attic campaigns
drywall|Drywall|drywall contractors|interior|subcontractor-heavy work, repair-vs-replace questions, and small-job economics|repair-vs-replace guides, texture-match galleries, and minimum-job booking flows
epoxy-flooring|Epoxy & Garage Floors|epoxy flooring companies|interior|finish-sample decisions, cure-time scheduling, and price comparison vs. DIY|finish-visualizer galleries, square-foot pricing, and one-day-install explainer pages
windows-doors|Windows & Doors|window and door companies|exterior|long quote cycles, rebate programs, and energy-efficiency claims|window-style comparison pages, rebate explainers, energy-savings calculators, and in-home quote booking
siding|Siding|siding contractors|exterior|material comparison, financing needs, and whole-home ticket sizes|material-comparison pages (fiber cement, vinyl, LP, cedar), financing calculators, and before/after galleries
chimney|Chimney & Fireplace|chimney sweeps and fireplace companies|specialty|hard seasonal peak, safety-inspection selling, and code questions|fall booking campaigns, inspection-package pages, code-and-safety explainers, and annual reminder automation
locksmith|Locksmith|locksmiths|specialty|emergency lockouts, scam-operator competition, and 24/7 dispatch|24/7 AI answering, lockout landing pages, verified-local trust blocks, and live ETA responses
appliance-repair|Appliance Repair|appliance repair companies|specialty|brand-model search traffic, parts availability, and same-day expectations|brand-and-model landing pages, diagnostic-fee explainers, and same-day booking flows
restoration|Water, Fire & Mold Restoration|restoration companies|specialty|24/7 emergency response, insurance-adjuster coordination, and IICRC credential trust|24/7 dispatch answering, insurance-process explainers, emergency landing pages, and adjuster-ready documentation
irrigation|Sprinklers & Irrigation|irrigation companies|outdoor-living|spring startup crunches, winterization deadlines, and low-ticket service calls|spring startup and blowout campaigns, recurring-service plans, and zone-repair booking
hardscaping|Hardscaping|hardscape contractors|outdoor-living|design-driven sales, material selection, and long spring backlogs|paver and retaining-wall galleries, design-consult booking, and material-comparison guides
artificial-turf|Artificial Turf|artificial turf installers|outdoor-living|square-foot price comparison, pet-owner questions, and water-savings selling|turf-product comparison pages, water-savings calculators, and pet-turf explainers
junk-removal|Junk Removal|junk removal companies|cleaning|same-day expectations, volume-based pricing confusion, and route efficiency|instant volume-based quoting, same-day booking, and item-type service pages
moving|Moving|moving companies|specialty|quote shopping, date-driven urgency, and scam-mover competition|instant move estimators, date-availability booking, licensing/insurance trust blocks, and review automation
dumpster-rental|Dumpster Rental|dumpster rental companies|cleaning|size confusion, permit rules, and delivery scheduling|size-selector tools, permit explainers by city, and online delivery booking
ev-charging|EV Charger Installation|EV charger installers|mechanical|panel-capacity questions, rebate programs, and brand compatibility|panel-assessment intake, rebate-by-utility pages, charger-brand compatibility guides, and install-quote flows
generators|Standby Generators|generator companies|mechanical|outage-driven demand spikes, sizing questions, and long install lead times|outage-season campaigns, generator-sizing calculators, and maintenance-plan signups
security-systems|Security & Low Voltage|security and low-voltage companies|specialty|monitoring-contract churn, DIY competition, and commercial vs. residential split|monitoring-plan pages, camera-system builders, and commercial/residential split funnels
smart-home|Smart Home & AV|smart home and AV integrators|specialty|custom scoping, brand ecosystems, and referral-only growth|system-design galleries, brand-ecosystem pages, and consultation booking flows
hot-tubs|Hot Tubs & Swim Spas|hot tub dealers and service companies|outdoor-living|showroom-dependent selling, delivery logistics, and service-plan retention|model-comparison pages, delivery-and-siting guides, and service-plan subscriptions
snow-removal|Snow & Ice Management|snow removal companies|outdoor-living|storm-triggered demand, seasonal contracts, and commercial-lot competition|seasonal contract signups, storm-alert notifications, and commercial-lot bid intake
welding|Welding & Fabrication|welding and fabrication shops|specialty|custom-quote work, mobile vs. shop jobs, and industrial buyer cycles|custom-fab quote intake, capability-and-material pages, and mobile-service dispatch
paving|Asphalt Paving & Sealcoating|paving companies|site-work|weather windows, commercial bid cycles, and seasonal crews|commercial bid intake, sealcoat-season campaigns, and lot-condition assessment forms
carpet-cleaning|Carpet & Upholstery Cleaning|carpet cleaning companies|cleaning|coupon-driven shoppers, room-count pricing, and repeat-customer neglect|room-count instant quoting, package pricing, and automated re-clean reminders
janitorial|Commercial Cleaning|janitorial and commercial cleaning companies|cleaning|contract-based sales, bid walkthroughs, and staffing turnover|commercial bid-request flows, facility-type pages, and walkthrough scheduling
handyman|Handyman|handyman services|interior|small-job economics, scope creep, and scheduling density|minimum-booking flows, task-menu pricing pages, and route-based scheduling
cabinets|Cabinets & Countertops|cabinet and countertop companies|interior|showroom selling, material comparison, and long fabrication timelines|material-comparison pages (quartz, granite, butcher block), design-consult booking, and timeline explainers
window-cleaning|Window Cleaning|window cleaning companies|cleaning|route economics, recurring-plan churn, and commercial vs. residential split|recurring-plan signups, pane-count instant quoting, and commercial route bidding
`;

const trades = TRD.trim().split('\n').map(line => {
  const [slug, name, plural, category, pain, systems] = line.split('|');
  return { slug, name, plural, category, pain, systems };
});

/* ============================== SERVICES ==============================
   slug | Name | short | core(1/0) | outcome-group | desc | features (;) | metaShort
   core = gets its own page in every tier-1 city
   rank = ordering weight for tier-2 cities (top 4 by rank get city pages everywhere) */
const SVC = `
web-design|Website Design & Development|Websites|1|get-found|fast, search-first websites built to convert calls and quote requests — owned by you, on your domain|Custom design on your brand, no templates;Core Web Vitals-fast static builds;Service and city pages engineered to rank;Call tracking and form analytics wired in;You own the domain, code, and content — forever|Fast, search-first websites that convert calls
seo|Local SEO|SEO|1|get-found|the local search system — map pack, service pages, city pages, and the links that make them stick|Google Business Profile built and tuned;City and service pages that target real searches;Citation cleanup and NAP consistency;Review velocity that moves map rankings;Reporting tied to calls, not impressions|Local SEO that puts you in the map pack
aeo|Answer Engine Optimization|AEO|1|get-found|getting your business named and cited when people ask ChatGPT, Gemini, Perplexity, and AI Overviews who to call|Content restructured into direct, liftable answers;FAQ, Service, and LocalBusiness schema on every page;llms.txt and AI-crawler access configured;Entity consistency across the sites AI models read;Monthly checks on what the assistants actually say about you|Get cited when buyers ask AI who to call
google-ads|Google Ads & LSAs|Google Ads|1|get-found|search campaigns and Local Services Ads that buy jobs, not clicks — with every dollar tracked to a booked call|Local Services Ads setup and Google Guaranteed badge;Tightly-scoped search campaigns by service and city;Negative-keyword discipline that kills wasted spend;Call tracking on every ad dollar;Budget pacing tied to your capacity|Search ads and LSAs that buy booked jobs
ai-receptionist|AI Receptionist|AI Answering|1|convert|an AI that answers every call in seconds, any hour, books the job, and escalates real emergencies to you|Answers 24/7, including nights and weekends;Books straight onto your calendar;Missed-call text-back within seconds;Emergency calls routed to your on-call phone;Every call transcribed and logged|24/7 AI answering that books the job
crm|CRM & Pipeline|CRM|1|follow-up|a pipeline that chases every estimate, logs every call, and never lets a quote die in silence|Every lead captured from every source;Automated estimate follow-up until they answer;Job stages you can see at a glance;Texting and calling from one inbox;Reporting on close rate by source|A pipeline that chases every estimate
email-sms-marketing|Email & SMS Marketing|Email & SMS|1|follow-up|seasonal campaigns, estimate follow-ups, and reactivation that turn your existing list into booked work|Reactivation campaigns to past customers;Seasonal reminders timed to local demand;Estimate follow-up sequences that run themselves;Compliant opt-in and STOP handling;Revenue attributed per campaign|Turn your customer list into booked work
reputation-management|Reputation Management|Reviews|1|convert|review requests after every job, responses in your voice, and problems routed to you before they go public|Automatic review requests after each job;Responses drafted in your voice;Negative feedback routed to you first;Review velocity tracked against competitors;Reviews syndicated to your site with schema|Review systems that build the rating
custom-software|Custom Software|Software|1|run-the-business|internal tools built around how your operation actually runs — quoting, scheduling, dispatch, and reporting|Built to your workflow, not a template's;Connects to the tools your crew already uses;Quoting, scheduling, and dispatch in one place;Owner dashboards with the numbers that matter;You own the code|Custom tools built around your operation
landing-pages|Landing Pages & CRO|Landing Pages|1|convert|single-purpose pages built for one service and one city, tuned until the conversion rate moves|One page, one service, one offer;Above-the-fold call and quote actions;Trust blocks: license, insurance, reviews;A/B tested headlines and forms;Built to pair with paid traffic|Pages built to convert paid traffic
local-services-ads|Google Local Services Ads|Local Services Ads|0|get-found|the Google Guaranteed badge and pay-per-lead placement above every other ad on the page|License and insurance verification handled;Google Guaranteed badge setup;Lead-dispute management so you don't pay for junk;Budget and service-area tuning;Lead quality reviewed weekly|Pay-per-lead placement above the ads
google-business-profile|Google Business Profile Management|Google Profile|0|get-found|the single highest-leverage local asset — built out, posted to, and defended against suspension|Full profile build-out with services and areas;Weekly posts, photos, and Q&A;Category and attribute optimization;Suspension prevention and reinstatement;Insights tracked against map rankings|The map-pack asset, built and defended
call-tracking|Call Tracking & Analytics|Call Tracking|0|run-the-business|numbers on every channel so you know which marketing actually produced the call — and which is burning money|Dynamic number insertion by source;Call recording and outcome tagging;Form and chat attribution;One dashboard tying spend to booked jobs;Monthly plain-English read-out|Know exactly which marketing books jobs
content-marketing|Content Marketing|Content|0|get-found|articles, guides, and service explainers written to rank and to answer the questions buyers actually ask|Topics mapped to real local search demand;Written for homeowners, structured for search;Internal links that lift your money pages;Published on your site, owned by you;Refreshed as rankings shift|Content that ranks and answers buyers
web-hosting-care|Hosting, Care & Security|Site Care|0|run-the-business|static hosting, uptime monitoring, backups, and the small changes you need without waiting on a queue|Fast static hosting with HTTPS;Uptime and Core Web Vitals monitoring;Backups and rollback;Content edits handled fast;No plugins to break|Hosting and site care with no queue
automation|Workflow Automation & AI Agents|Automation|0|run-the-business|the repetitive parts of your operation handled by software — intake, dispatch notes, invoicing nudges, reporting|Lead intake routed automatically;Job data flowing between your tools;AI agents for quoting and summarizing;Owner alerts on the things that matter;Built on tools you can keep|Software that runs the repetitive work
booking-scheduling|Online Booking & Scheduling|Booking|0|convert|let customers book a real slot on your calendar at midnight instead of leaving a voicemail|Live availability by crew and service;Deposits and card-on-file options;Automatic confirmations and reminders;Route-aware scheduling;Syncs to the calendar you already use|Let buyers book a slot at midnight
meta-ads|Meta Ads|Meta Ads|0|get-found|Facebook and Instagram campaigns for the offers that sell on interruption, not search|Offer-first creative built for the feed;Geo and homeowner targeting;Lead forms wired straight into your CRM;Retargeting site visitors who didn't call;Cost-per-booked-job reporting|Feed ads for offers that sell on sight
social-media|Social Media Management|Social|0|convert|proof-of-work posting that makes you look like the busiest, most competent shop in town|Job-site photo and video posting;Consistent posting cadence;Review and testimonial reposting;Profile optimization for local search;Comment and message monitoring|Proof-of-work posting, done consistently
video-photo|Photo & Video Content|Photo & Video|0|convert|real footage of your crew and your finished work — the single most persuasive asset a service business owns|Job-site photo and video capture direction;Short-form vertical edits for feeds;Before/after sequences;Owner-intro and testimonial pieces;Usable across site, ads, and social|Real footage of real work, edited to sell
branding|Branding & Identity|Branding|0|convert|a mark, a palette, and a voice that make a two-truck operation look like the standard in your market|Logo and wordmark system;Color, type, and truck-wrap direction;Voice and messaging guidelines;Uniform, yard sign, and vehicle application;Full source files handed to you|Look like the standard in your market
link-building|Authority Link Building|Link Building|0|get-found|manual, white-hat backlinks from real sites that move local rankings|Manual outreach to real publications;DR-tiered placements to fit budget;Anchors planned against your keyword map;Every URL reported;No PBNs, no spam, nothing that risks the domain|White-hat links that move rankings
press-releases|Press Release Writing & Distribution|Press|0|get-found|professionally written announcements distributed through established newswire networks|Written by a newswire pro;Distribution through established networks;Local media targeting for your market;Brand-search dominance for your name;Live syndication report|Newswire announcements that own your name
`;

const services = SVC.trim().split('\n').map((line, i) => {
  const [slug, name, short, core, group, desc, features, metaShort] = line.split('|');
  return { slug, name, short, core: core === '1', group, rank: i, desc, features: features.split(';'), metaShort };
});

/* service groups, for the grouped/filterable services hub */
const serviceGroups = [
  { key: 'get-found', label: 'Get found', blurb: 'Show up first when someone in your market needs the work done — in search, in the map pack, and in AI answers.' },
  { key: 'convert', label: 'Turn traffic into calls', blurb: 'Everything between "they found you" and "they called you" — pages, proof, answering, and booking.' },
  { key: 'follow-up', label: 'Follow up automatically', blurb: 'The money left on the table: estimates nobody chased and customers nobody called back.' },
  { key: 'run-the-business', label: 'Run the business', blurb: 'The software layer underneath it all — tools, tracking, hosting, and automation you own.' },
];

const tradeCategories = [
  { key: 'exterior', label: 'Exterior & Envelope' },
  { key: 'mechanical', label: 'Mechanical & Electrical' },
  { key: 'interior', label: 'Interior & Finish' },
  { key: 'outdoor-living', label: 'Outdoor Living & Grounds' },
  { key: 'site-work', label: 'Site Work & Structure' },
  { key: 'cleaning', label: 'Cleaning & Hauling' },
  { key: 'specialty', label: 'Specialty & Emergency' },
];

/* sanity: every answer points at a real service, every slug is unique */
const svcSlugs = new Set(services.map(s => s.slug));
const seen = new Set();
for (const a of answers) {
  if (!svcSlugs.has(a.svc)) throw new Error(`answer ${a.slug} references unknown service ${a.svc}`);
  if (seen.has(a.slug)) throw new Error(`duplicate answer slug ${a.slug}`);
  seen.add(a.slug);
  if (!a.a || a.a.split(' ').length > 90) throw new Error(`answer ${a.slug}: direct answer missing or too long to be liftable`);
}
for (const c of new Set(answers.map(a => a.cat))) {
  if (!answerCategories.some(x => x.key === c)) throw new Error(`answer category ${c} not declared`);
}

out('locations.json', locations);
out('trades.json', trades);
out('services.json', services);
out('answers.json', answers);
out('taxonomy.json', { serviceGroups, tradeCategories, answerCategories, states: STATE_NAME });

const tier1 = locations.filter(l => l.tier === 1).length;
const core = services.filter(s => s.core).length;
console.log(`locations ${locations.length} (tier1 ${tier1}, tier2 ${locations.length - tier1}) · trades ${trades.length} · services ${services.length} (core ${core}) · answers ${answers.length}`);
console.log(`projected: ${tier1 * core + (locations.length - tier1) * 4} city-service + ${locations.length} city hubs + ${trades.length * Object.keys(STATE_NAME).length} trade-state`);
