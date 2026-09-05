import { mount } from 'svelte'
import './styles.css'
import App from './ui/App.svelte'

export default mount(App, { target: document.getElementById('app')! })
