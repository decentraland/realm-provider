// Complete country centroid data (ISO-3166-1 alpha-2 to [lat, lon])
// Source: Country centroids based on geographical boundaries
export const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  AF: [33.9391, 67.71], // Afghanistan
  AL: [41.1533, 20.1683], // Albania
  DZ: [28.0339, 1.6596], // Algeria
  AS: [-14.271, -170.1322], // American Samoa
  AD: [42.5, 1.5], // Andorra
  AO: [-11.2027, 17.8739], // Angola
  AI: [18.2206, -63.0686], // Anguilla
  AQ: [-90, 0], // Antarctica
  AG: [17.0608, -61.7964], // Antigua and Barbuda
  AR: [-38.4161, -63.6167], // Argentina
  AM: [40.0691, 45.0382], // Armenia
  AW: [12.5211, -69.9683], // Aruba
  AU: [-25.2744, 133.7751], // Australia
  AT: [47.5162, 14.5501], // Austria
  AZ: [40.1431, 47.5769], // Azerbaijan
  BS: [25.0343, -77.3963], // Bahamas
  BH: [26.0667, 50.5577], // Bahrain
  BD: [23.685, 90.3563], // Bangladesh
  BB: [13.1939, -59.5432], // Barbados
  BY: [53.7098, 27.9534], // Belarus
  BE: [50.8503, 4.3517], // Belgium
  BZ: [17.1899, -88.4976], // Belize
  BJ: [9.3077, 2.3158], // Benin
  BM: [32.3078, -64.7505], // Bermuda
  BT: [27.5142, 90.4336], // Bhutan
  BO: [-16.2902, -63.5887], // Bolivia
  BA: [43.9159, 17.6791], // Bosnia and Herzegovina
  BW: [-22.3285, 24.6849], // Botswana
  BV: [-54.4232, 3.4139], // Bouvet Island
  BR: [-14.235, -51.9253], // Brazil
  IO: [-6.3432, 71.8765], // British Indian Ocean Territory
  BN: [4.5353, 114.7277], // Brunei
  BG: [42.7339, 25.4858], // Bulgaria
  BF: [12.2383, -1.5616], // Burkina Faso
  BI: [-3.3731, 29.9189], // Burundi
  KH: [12.5657, 104.991], // Cambodia
  CM: [7.3697, 12.3547], // Cameroon
  CA: [56.1304, -106.3468], // Canada
  CV: [16.5388, -23.0418], // Cape Verde
  KY: [19.3133, -81.2546], // Cayman Islands
  CF: [6.6111, 20.9394], // Central African Republic
  TD: [15.4542, 18.7322], // Chad
  CL: [-35.6751, -71.543], // Chile
  CN: [35.8617, 104.1954], // China
  CX: [-10.4475, 105.6904], // Christmas Island
  CC: [-12.1642, 96.871], // Cocos (Keeling) Islands
  CO: [4.5709, -74.2973], // Colombia
  KM: [-11.6455, 43.3333], // Comoros
  CG: [-0.228, 15.8277], // Congo
  CD: [-4.0383, 21.7587], // Congo, Democratic Republic
  CK: [-21.2368, -159.7777], // Cook Islands
  CR: [9.9281, -84.0907], // Costa Rica
  CI: [7.54, -5.5471], // Côte d'Ivoire
  HR: [45.1, 15.2], // Croatia
  CU: [21.5218, -77.7812], // Cuba
  CY: [35.1264, 33.4299], // Cyprus
  CZ: [49.8175, 15.473], // Czech Republic
  DK: [56.2639, 9.5018], // Denmark
  DJ: [11.8251, 42.5903], // Djibouti
  DM: [15.415, -61.371], // Dominica
  DO: [18.7357, -70.1627], // Dominican Republic
  EC: [-1.8312, -78.1834], // Ecuador
  EG: [26.8206, 30.8025], // Egypt
  SV: [13.7942, -88.8965], // El Salvador
  GQ: [1.6508, 10.2679], // Equatorial Guinea
  ER: [15.1794, 39.7823], // Eritrea
  EE: [58.5953, 25.0136], // Estonia
  ET: [9.145, 40.4897], // Ethiopia
  FK: [-51.7963, -59.5236], // Falkland Islands
  FO: [61.8926, -6.9118], // Faroe Islands
  FJ: [-17.7134, 178.065], // Fiji
  FI: [61.9241, 25.7482], // Finland
  FR: [46.6034, 1.8883], // France
  GF: [3.9339, -53.1258], // French Guiana
  PF: [-17.6797, -149.4068], // French Polynesia
  TF: [-49.2804, 69.3486], // French Southern Territories
  GA: [-0.8037, 11.6094], // Gabon
  GM: [13.4432, -15.3101], // Gambia
  GE: [42.3154, 43.3569], // Georgia
  DE: [51.1657, 10.4515], // Germany
  GH: [7.9465, -1.0232], // Ghana
  GI: [36.1377, -5.3453], // Gibraltar
  GR: [39.0742, 21.8243], // Greece
  GL: [71.7069, -42.6043], // Greenland
  GD: [12.1165, -61.679], // Grenada
  GP: [16.265, -61.551], // Guadeloupe
  GU: [13.4443, 144.7937], // Guam
  GT: [15.7835, -90.2308], // Guatemala
  GG: [49.4657, -2.5853], // Guernsey
  GN: [9.9456, -9.6966], // Guinea
  GW: [11.8037, -15.1804], // Guinea-Bissau
  GY: [4.8604, -58.9302], // Guyana
  HT: [18.9712, -72.2852], // Haiti
  HM: [-53.0818, 73.5042], // Heard Island and McDonald Islands
  VA: [41.9029, 12.4534], // Holy See (Vatican City State)
  HN: [15.1999, -86.2419], // Honduras
  HK: [22.3193, 114.1694], // Hong Kong
  HU: [47.1625, 19.5033], // Hungary
  IS: [64.9631, -19.0208], // Iceland
  IN: [20.5937, 78.9629], // India
  ID: [-0.7893, 113.9213], // Indonesia
  IR: [32.4279, 53.688], // Iran
  IQ: [33.2232, 43.6793], // Iraq
  IE: [53.1424, -7.6921], // Ireland
  IM: [54.2361, -4.5481], // Isle of Man
  IL: [31.0461, 34.8516], // Israel
  IT: [41.8719, 12.5674], // Italy
  JM: [18.1096, -77.2975], // Jamaica
  JP: [36.2048, 138.2529], // Japan
  JE: [49.2144, -2.1312], // Jersey
  JO: [30.5852, 36.2384], // Jordan
  KZ: [48.0196, 66.9237], // Kazakhstan
  KE: [-0.0236, 37.9062], // Kenya
  KI: [-3.3704, -168.734], // Kiribati
  KP: [40.3399, 127.5101], // North Korea
  KR: [35.9078, 127.7669], // South Korea
  KW: [29.3117, 47.4818], // Kuwait
  KG: [41.2044, 74.7661], // Kyrgyzstan
  LA: [19.8563, 102.4955], // Laos
  LV: [56.8796, 24.6032], // Latvia
  LB: [33.8547, 35.8623], // Lebanon
  LS: [-29.6099, 28.2336], // Lesotho
  LR: [6.4281, -9.4295], // Liberia
  LY: [26.3351, 17.2283], // Libya
  LI: [47.166, 9.5554], // Liechtenstein
  LT: [55.1694, 23.8813], // Lithuania
  LU: [49.8153, 6.1296], // Luxembourg
  MO: [22.1987, 113.5439], // Macao
  MK: [41.6086, 21.7453], // North Macedonia
  MG: [-18.7669, 46.8691], // Madagascar
  MW: [-13.2543, 34.3015], // Malawi
  MY: [4.2105, 108.9758], // Malaysia
  MV: [3.2028, 73.2207], // Maldives
  ML: [17.5707, -3.9962], // Mali
  MT: [35.9375, 14.3754], // Malta
  MH: [7.1315, 171.1845], // Marshall Islands
  MQ: [14.6415, -61.0242], // Martinique
  MR: [21.0079, -10.9408], // Mauritania
  MU: [-20.3484, 57.5522], // Mauritius
  YT: [-12.8275, 45.1662], // Mayotte
  MX: [23.6345, -102.5528], // Mexico
  FM: [7.4256, 150.5508], // Micronesia
  MD: [47.4116, 28.3699], // Moldova
  MC: [43.7384, 7.4246], // Monaco
  MN: [46.8625, 103.8467], // Mongolia
  ME: [42.7087, 19.3744], // Montenegro
  MS: [16.7425, -62.1874], // Montserrat
  MA: [31.7917, -7.0926], // Morocco
  MZ: [-18.6657, 35.5296], // Mozambique
  MM: [21.9162, 95.956], // Myanmar
  NA: [-22.9576, 18.4904], // Namibia
  NR: [-0.5228, 166.9315], // Nauru
  NP: [28.3949, 84.124], // Nepal
  NL: [52.1326, 5.2913], // Netherlands
  NC: [-20.9043, 165.618], // New Caledonia
  NZ: [-40.9006, 174.886], // New Zealand
  NI: [12.8654, -85.2072], // Nicaragua
  NE: [17.6078, 8.0817], // Niger
  NG: [9.082, 8.6753], // Nigeria
  NU: [-19.0544, -169.8672], // Niue
  NF: [-29.0408, 167.9547], // Norfolk Island
  MP: [17.3308, 145.3847], // Northern Mariana Islands
  NO: [60.472, 8.4689], // Norway
  OM: [21.4735, 55.9754], // Oman
  PK: [30.3753, 69.3451], // Pakistan
  PW: [7.515, 134.5825], // Palau
  PS: [31.9522, 35.2332], // Palestine
  PA: [8.538, -80.7821], // Panama
  PG: [-6.315, 143.9555], // Papua New Guinea
  PY: [-23.4425, -58.4438], // Paraguay
  PE: [-9.19, -75.0152], // Peru
  PH: [12.8797, 121.774], // Philippines
  PN: [-24.7036, -127.4393], // Pitcairn
  PL: [51.9194, 19.1451], // Poland
  PT: [39.3999, -8.2245], // Portugal
  PR: [18.2208, -66.5901], // Puerto Rico
  QA: [25.3548, 51.1839], // Qatar
  RE: [-21.1151, 55.5364], // Réunion
  RO: [45.9432, 24.9668], // Romania
  RU: [61.524, 105.3188], // Russia
  RW: [-1.9403, 29.8739], // Rwanda
  BL: [17.9139, -62.8339], // Saint Barthélemy
  SH: [-24.1435, -10.0307], // Saint Helena
  KN: [17.3578, -62.783], // Saint Kitts and Nevis
  LC: [13.9094, -60.9789], // Saint Lucia
  MF: [18.0826, -63.0522], // Saint Martin
  PM: [46.8852, -56.3159], // Saint Pierre and Miquelon
  VC: [12.9843, -61.2872], // Saint Vincent and the Grenadines
  WS: [-13.759, -172.1046], // Samoa
  SM: [43.9424, 12.4578], // San Marino
  ST: [0.1864, 6.6131], // Sao Tome and Principe
  SA: [23.8859, 45.0792], // Saudi Arabia
  SN: [14.4974, -14.4524], // Senegal
  RS: [44.0165, 21.0059], // Serbia
  SC: [-4.6796, 55.492], // Seychelles
  SL: [8.4606, -11.7799], // Sierra Leone
  SG: [1.3521, 103.8198], // Singapore
  SK: [48.669, 19.699], // Slovakia
  SI: [46.0569, 14.5058], // Slovenia
  SB: [-9.6457, 160.1562], // Solomon Islands
  SO: [5.1521, 46.1996], // Somalia
  ZA: [-30.5595, 22.9375], // South Africa
  GS: [-54.4232, -36.6067], // South Georgia and the South Sandwich Islands
  SS: [6.877, 31.307], // South Sudan
  ES: [40.4637, -3.7492], // Spain
  LK: [7.8731, 80.7718], // Sri Lanka
  SD: [12.8628, 30.2176], // Sudan
  SR: [3.9193, -56.0278], // Suriname
  SJ: [77.5536, 23.6703], // Svalbard and Jan Mayen
  SZ: [-26.5225, 31.4659], // Eswatini
  SE: [60.1282, 18.6435], // Sweden
  CH: [46.8182, 8.2275], // Switzerland
  SY: [34.8021, 38.9968], // Syria
  TW: [23.6978, 121.1355], // Taiwan
  TJ: [38.5358, 71.0961], // Tajikistan
  TZ: [-6.369, 34.8888], // Tanzania
  TH: [15.87, 100.9925], // Thailand
  TL: [-8.8742, 125.7275], // Timor-Leste
  TG: [8.6195, 0.8248], // Togo
  TK: [-8.9674, -171.8559], // Tokelau
  TO: [-21.179, -175.1982], // Tonga
  TT: [10.6598, -61.519], // Trinidad and Tobago
  TN: [33.8869, 9.5375], // Tunisia
  TR: [38.9637, 35.2433], // Turkey
  TM: [38.9697, 59.5563], // Turkmenistan
  TC: [21.694, -71.7979], // Turks and Caicos Islands
  TV: [-7.1095, 177.6493], // Tuvalu
  UG: [1.3733, 32.2903], // Uganda
  UA: [48.3794, 31.1656], // Ukraine
  AE: [23.4241, 53.8478], // United Arab Emirates
  GB: [55.3781, -3.436], // United Kingdom
  US: [39.8283, -98.5795], // United States
  UM: [19.2823, 166.647], // United States Minor Outlying Islands
  UY: [-32.5228, -55.7658], // Uruguay
  UZ: [41.3775, 64.5853], // Uzbekistan
  VU: [-15.3767, 166.9592], // Vanuatu
  VE: [6.4238, -66.5897], // Venezuela
  VN: [14.0583, 108.2772], // Vietnam
  VG: [18.3358, -64.8963], // British Virgin Islands
  VI: [18.3358, -64.8963], // U.S. Virgin Islands
  WF: [-14.2938, -178.1165], // Wallis and Futuna
  EH: [24.2155, -12.8858], // Western Sahara
  YE: [15.5527, 48.5164], // Yemen
  ZM: [-13.1339, 27.8493], // Zambia
  ZW: [-19.0154, 29.1549] // Zimbabwe
}
