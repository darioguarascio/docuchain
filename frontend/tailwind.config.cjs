/** @type {import('tailwindcss').Config} */

//const colors = require('tailwindcss/colors')


module.exports = {
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}",
  ],
  theme: {
    extend: {
      colors: {
        'jethr-black': {
          'text': '#11150A'
        },
        'jethr-gray': {
          'text': '#3F4340',
          'border': '#CFD6CD',
          'bg': '#FBFCFB',
          'placeholder': '#868C88',
          'icon': '#888A85',
          'infobg': '#E0E6DC',
          'infoi': '#59615F'
        },
        'jethr-success': {
          'dark': '#529B2E',
          'light': '#E1F3D8'
        }
      }
    },
  },
  plugins: [
    //require("flowbite/plugin")
  ],
};
