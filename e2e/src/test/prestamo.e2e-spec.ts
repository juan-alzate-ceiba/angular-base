// import { NavbarPage } from './../page/navbar/navbar.po';
import { PrestamoPage } from './../page/prestamo/prestamo.po';
// import { browser } from 'protractor';

const ISBN = 'A354874R';
const NOMBRE_PRESTADOR = 'Felipe Alzate';

describe('workspace-project Prestamo', () => {
  // let navBar: NavbarPage;
  let prestamo: PrestamoPage;

  beforeEach(() => {
    // navBar = new NavbarPage();
    prestamo = new PrestamoPage();
  });

  it('Debería mostrar mensajes de requerido', () => {

    // browser.get('/#/prestamos');
    // navBar.clickLinkPrestamos();

    prestamo.setIsbn('');
    prestamo.setNombre(NOMBRE_PRESTADOR);
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorRequired();
      expect(mensaje).toEqual('ISBN es obligatorio');
    });

    prestamo.setIsbn(ISBN);
    prestamo.setNombre('');
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorRequired();
      expect(mensaje).toEqual('Nombre es obligatorio');
    });
  });


});
