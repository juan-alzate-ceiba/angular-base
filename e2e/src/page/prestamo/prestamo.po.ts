import { element, by } from 'protractor';

export class PrestamoPage {
  private isbnPrestamo = element(by.id('isbnPrestamo'));
  private nombrePrestador = element(by.id('nombrePrestador'));
  private prestarBtn = element(by.id('prestar'));
  private titulo = element(by.css('h1'));
  private formulario = element(by.tagName('form'));
  private mensajeRequerido = element(by.className('invalid-feedback'));

  async setIsbn(isbn: string) {
    await this.isbnPrestamo.sendKeys(isbn);
  }

  async setNombre(nombre: string) {
    await this.nombrePrestador.sendKeys(nombre);
  }

  async getTitulo() {
    await this.titulo.getText();
  }

  async getMensajeErrorRequired() {
    await this.mensajeRequerido.findElement('div').getText();
  }

  async getForm() {
    await this.formulario.getTagName();
  }

  async clickBotonPrestar() {
    await this.prestarBtn.click();
  }
}
