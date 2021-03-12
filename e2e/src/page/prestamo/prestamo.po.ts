import { element, by } from 'protractor';

export class PrestamoPage {
  private isbnPrestamo = element(by.id('isbnPrestamos'));
  private nombrePrestador = element(by.id('nombrePrestador'));
  private prestarBtn = element(by.id('prestar'));

  async setIsbn(isbn: string) {
    await this.isbnPrestamo.sendKeys(isbn);
  }

  async setNombre(nombre: string) {
    await this.nombrePrestador.sendKeys(nombre);
  }

  async clickBotonPrestar() {
    await this.prestarBtn.click();
  }
}
