import { by, element } from 'protractor';

export class NavbarPage {
    linkHome = element(by.id('home'));
    linkPrestamos = element(by.id('prestamos'));
    linkLibros = element(by.id('libros'));

    async clickLinkPrestamos() {
      await this.linkPrestamos.click();
    }

    async clickLinkLibros() {
      await this.linkLibros.click();
    }
}
