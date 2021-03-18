import { element, by, By, browser } from 'protractor';

export class PrestamoPage {
  private isbnPrestamo = element(By.id('isbnPrestamo'));
  private nombrePrestador = element(by.id('nombrePrestador'));
  private prestarBtn = element(by.id('prestar'));
  private mensajeISBNRequerido = element(by.id('isbnPrestamoMensaje'));
  private mensajeNombreRequerido = element(by.id('nombrePrestamoMensaje'));

  navigateTo() {
    return browser.get('prestamos') as Promise<any>;
  }

  async setIsbn(isbn: string) {
    await this.isbnPrestamo.sendKeys(isbn);
  }

  async setNombre(nombre: string) {
    await this.nombrePrestador.sendKeys(nombre);
  }

  async getMensajeErrorISBNRequerido() {
    return this.mensajeISBNRequerido.getText();
  }

  async getMensajeErrorNombreRequirido() {
    return this.mensajeNombreRequerido.getText();
  }

  async clickBotonPrestar() {
    await this.prestarBtn.click();
  }
}
