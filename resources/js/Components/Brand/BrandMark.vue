<script setup lang="ts">
import { useId } from 'vue'

const rawId = useId()
const safeId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '')
const gradientId = `upin-${safeId}`
const glowId = `upin-glow-${safeId}`
</script>
<template>
  <svg viewBox="0 0 512 512" aria-hidden="true" role="presentation">
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FD267D" />
        <stop offset="0.55" stop-color="#E936C7" />
        <stop offset="1" stop-color="#FF7854" />
      </linearGradient>
      <radialGradient :id="glowId" cx="0.5" cy="0.35" r="0.8">
        <stop offset="0" stop-color="#FFFFFF" stop-opacity="0.35" />
        <stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="512" height="512" rx="128" :fill="`url(#${gradientId})`" />
    <rect width="512" height="512" rx="128" :fill="`url(#${glowId})`" />
    <path d="M256 108c-70 0-122 52-122 120 0 92 112 176 112 176s112-84 112-176c0-68-52-120-102-120z" fill="#fff" />
    <path d="M247 272c-26-16-42-32-42-50 0-14 11-24 24-24 9 0 15 4 18 10 3-6 9-10 18-10 13 0 24 10 24 24 0 18-16 34-42 50z" fill="#FD267D" />
    <circle cx="196" cy="192" r="14" fill="#fff" opacity="0.9" />
    <circle cx="332" cy="150" r="7" fill="#fff" opacity="0.7" />
    <circle cx="352" cy="182" r="4.5" fill="#fff" opacity="0.6" />
  </svg>
</template>
