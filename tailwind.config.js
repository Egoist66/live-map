import defaultTheme from 'tailwindcss/defaultTheme';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        './vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php',
        './storage/framework/views/*.php',
        './resources/views/**/*.blade.php',
        './resources/js/**/*.vue',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Figtree', 'Inter', ...defaultTheme.fontFamily.sans],
                display: ['Figtree', ...defaultTheme.fontFamily.sans],
            },
            colors: {
                ink: {
                    950: '#070A14',
                    900: '#0F172A',
                    800: '#1E293B',
                    700: '#334155',
                    600: '#475569',
                },
                brand: {
                    50: '#EEF0FF',
                    100: '#E0E3FF',
                    500: '#5B5BFF',
                    600: '#4F46E5',
                    700: '#4338CA',
                },
                accent: {
                    teal: '#06B6D4',
                    amber: '#F59E0B',
                    coral: '#FF6B4A',
                },
                surface: {
                    DEFAULT: '#F8F7F3',
                    card: '#FFFFFF',
                    muted: '#F1F0ED',
                },
            },
            borderRadius: {
                '2xl': '16px',
                '3xl': '20px',
                '4xl': '24px',
                '5xl': '32px',
            },
            boxShadow: {
                'soft': '0 2px 20px -4px rgba(15,23,42,0.08)',
                'card': '0 8px 32px -12px rgba(15,23,42,0.12)',
                'float': '0 16px 48px -16px rgba(15,23,42,0.18)',
                'glow': '0 0 32px rgba(91,91,255,0.15)',
            },
        },
    },
    plugins: [forms],
};
