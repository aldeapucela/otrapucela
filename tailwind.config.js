import typography from "@tailwindcss/typography";

export default {
  content: [
    "./src/**/*.{njk,html,md,js}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Georgia", "ui-serif", "serif"]
      },
      typography: {
        DEFAULT: {
          css: {
            color: "#1f2937",
            maxWidth: "65ch",
            a: {
              color: "#5c7785",
              textDecoration: "underline",
              textUnderlineOffset: "0.18em",
              textDecorationThickness: "0.08em",
              textDecorationColor: "#97a9b2",
              transition: "color 200ms ease, text-decoration-color 200ms ease"
            },
            "a:hover": {
              color: "#435a66",
              textDecorationColor: "#435a66"
            },
            p: {
              marginTop: "1.1em",
              marginBottom: "1.1em"
            },
            img: {
              marginTop: "1.5em",
              marginBottom: "1.5em"
            },
            hr: {
              marginTop: "2.5em",
              marginBottom: "2.5em"
            }
          }
        },
        lg: {
          css: {
            fontSize: "1.125rem",
            lineHeight: "1.8"
          }
        }
      }
    }
  },
  plugins: [
    typography
  ]
};
