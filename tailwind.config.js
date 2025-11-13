export const content = ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"]

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./renderer/src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"]
      },
      colors: {
        // Horalix Halo Brand Colors
        halo: {
          purple: {
            50: "#faf5ff",
            100: "#f3e8ff",
            200: "#e9d5ff",
            300: "#d8b4fe",
            400: "#c084fc",
            500: "#a855f7",
            600: "#9333ea",
            700: "#7e22ce",
            800: "#6b21a8",
            900: "#581c87",
            950: "#3b0764",
          },
          indigo: {
            50: "#eef2ff",
            100: "#e0e7ff",
            200: "#c7d2fe",
            300: "#a5b4fc",
            400: "#818cf8",
            500: "#6366f1",
            600: "#4f46e5",
            700: "#4338ca",
            800: "#3730a3",
            900: "#312e81",
            950: "#1e1b4b",
          },
          teal: {
            50: "#f0fdfa",
            100: "#ccfbf1",
            200: "#99f6e4",
            300: "#5eead4",
            400: "#2dd4bf",
            500: "#14b8a6",
            600: "#0d9488",
            700: "#0f766e",
            800: "#115e59",
            900: "#134e4a",
            950: "#042f2e",
          },
        },
      },
      backgroundImage: {
        // Horalix Gradients
        "halo-dark": "linear-gradient(135deg, #020617 0%, #0F172A 50%, #083344 100%)",
        "halo-light": "linear-gradient(135deg, #F0F9FF 0%, #F1F5F9 50%, #ECFDF5 100%)",
        "halo-purple": "linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%)",
        "halo-gradient": "linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #14B8A6 100%)",
        "halo-gradient-subtle": "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(99,102,241,0.1) 50%, rgba(20,184,166,0.1) 100%)",
      },
      backdropBlur: {
        xs: "2px",
      },
      animation: {
        // Existing
        in: "in 0.2s ease-out",
        out: "out 0.2s ease-in",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
        "text-gradient-wave": "textGradientWave 2s infinite ease-in-out",
        // New Horalix Animations
        "fade-in": "fadeIn 0.3s ease-out",
        "fade-out": "fadeOut 0.3s ease-in",
        "slide-up": "slideUp 0.3s ease-out",
        "slide-down": "slideDown 0.3s ease-out",
        "scale-in": "scaleIn 0.2s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
      },
      keyframes: {
        // Existing
        textGradientWave: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" }
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" }
        },
        in: {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        out: {
          "0%": { transform: "translateY(0)", opacity: "1" },
          "100%": { transform: "translateY(100%)", opacity: "0" }
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" }
        },
        // New Horalix Keyframes
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" }
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        slideDown: {
          "0%": { transform: "translateY(-10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        glowPulse: {
          "0%, 100%": {
            boxShadow: "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(99, 102, 241, 0.2)"
          },
          "50%": {
            boxShadow: "0 0 30px rgba(139, 92, 246, 0.5), 0 0 60px rgba(99, 102, 241, 0.3)"
          }
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-5px)" }
        },
      },
      boxShadow: {
        "glass": "0 8px 32px 0 rgba(0, 0, 0, 0.1)",
        "glass-lg": "0 12px 48px 0 rgba(0, 0, 0, 0.15)",
        "glass-xl": "0 20px 64px 0 rgba(0, 0, 0, 0.2)",
        "glow": "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(99, 102, 241, 0.2)",
        "glow-lg": "0 0 30px rgba(139, 92, 246, 0.4), 0 0 60px rgba(99, 102, 241, 0.3)",
      },
    }
  },
  plugins: []
}
