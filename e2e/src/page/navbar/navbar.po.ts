import { by, element } from 'protractor';

export class NavbarPage {
    linkHome = element(by.xpath('/html/body/app-root/app-navbar/nav/a[1]'));
    linkPrestamos = element(by.xpath('/html/body/app-root/app-navbar/nav/a[2]'));
    linkLibros = element(by.xpath('/html/body/app-root/app-navbar/nav/a[3]'));

    async clickBotonPrestamos() {
      await this.linkPrestamos.click();
    }

    async clickBotonLibros() {
      await this.linkLibros.click();
    }
}
