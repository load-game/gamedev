import { ClientBuilder } from './ClientBuilder.js'

export class AdminBuilder extends ClientBuilder {
  canBuild() {
    return true
  }
}
