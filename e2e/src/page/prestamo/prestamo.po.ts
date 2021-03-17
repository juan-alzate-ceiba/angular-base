import { element, by, By } from 'protractor';

export class PrestamoPage {
  private isbnPrestamo = element(By.css('#isbnPrestamo'));
  private nombrePrestador = element(by.css('#nombrePrestador'));
  private prestarBtn = element(by.id('prestar'));
  private mensajeRequerido = element(by.className('invalid-feedback'));

  async setIsbn(isbn: string) {
    await this.isbnPrestamo.sendKeys(isbn);
  }

  async setNombre(nombre: string) {
    await this.nombrePrestador.sendKeys(nombre);
  }

  async getMensajeErrorRequired() {
    return await this.mensajeRequerido.findElement('div').getText();
  }

  async clickBotonPrestar() {
    await this.prestarBtn.click();
  }
}
