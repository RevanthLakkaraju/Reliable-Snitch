export const PHOTO_CREDITS = [
  {
    file: "bengaluru-road.jpg",
    title: "Roads deformed T munnekollala Bengaluru 2",
    author: "Gangaasoonu",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Roads_deformed_T_munnekollala_Bengaluru_2.jpg",
  },
  {
    file: "hyderabad-waste.jpg",
    title: "Garbage Disposal Hyderabad 2005",
    author: "melgupta",
    license: "CC BY-SA 2.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Garbage_Disposal_Hyderabad_2005.jpg",
  },
  {
    file: "navagarhi-drain.jpg",
    title: "Drainage Problem in Navagarhi",
    author: "Oo7abhishekcool",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source:
      "https://commons.wikimedia.org/wiki/File:Drainage_Problem_in_Navagarhi.jpg",
  },
  {
    file: "hyderabad-street.jpg",
    title: "Gachibowli flyover",
    author: "Adbh266",
    license: "CC BY-SA 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
    source: "https://commons.wikimedia.org/wiki/File:Gachibowli_flyover.jpg",
  },
];
const photos: Record<string, string> = {
  "TE-1001": "bengaluru-road.jpg",
  "TE-1002": "hyderabad-street.jpg",
  "TE-1003": "hyderabad-waste.jpg",
  "TE-1004": "navagarhi-drain.jpg",
  "TE-1007": "navagarhi-drain.jpg",
  "TE-1008": "hyderabad-waste.jpg",
  "TE-1009": "hyderabad-street.jpg",
  "TE-1010": "navagarhi-drain.jpg",
  "TE-1011": "bengaluru-road.jpg",
  "TE-1012": "hyderabad-waste.jpg",
  "TE-1013": "hyderabad-street.jpg",
};
export function demoPhoto(id: string) {
  return photos[id] ? "/demo/" + photos[id] : null;
}
