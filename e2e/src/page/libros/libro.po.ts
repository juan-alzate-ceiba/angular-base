import { element, by, browser } from "protractor";

export class LibroPage {
  private isbnLibro = element(by.css('[id="isbnLibro"]'));
  private tituloLibro = element(by.id('tituloLibro'));
  private anio = element(by.id('anio'));
  private btnCrear = element(by.id('crear'));
  private mensajeIsbnRequerido = element(by.id('isbnMensajeError'));
  private mensajeTituloRequerido = element(by.id('tituloMensajeError'));
  private mensajeAnioRequerido = element(by.id('anioMensajeError'));

  navigateTo() {
    return browser.get('libros') as Promise<any>;
  }

  async setIsbn(isbn: string) {
    await this.isbnLibro.sendKeys(isbn);
  }

  async setTitulo(titulo: string) {
    await this.tituloLibro.sendKeys(titulo);
  }

  async setAnio(anio: number) {
    await this.anio.sendKeys(anio);
  }

  async clickBotonCrear() {
    await this.btnCrear.click();
  }

  async getMensajeErrorIsbnRequerido() {
    return await this.mensajeIsbnRequerido.getText();
  }

  async getMensajeErrorTituloRequerido() {
    return this.mensajeTituloRequerido.getText();
  }

  async getMensajeErrorAnioRequerido() {
    return await this.mensajeAnioRequerido.getText();
  }

}
