import { NavbarPage } from './../page/navbar/navbar.po';
import { PrestamoPage } from './../page/prestamo/prestamo.po';
import { AppPage } from './../app.po';
describe('workspace-project Prestamo', () => {
  let page: AppPage;
  let navBar: NavbarPage;
  let prestamo: PrestamoPage;

  beforeEach(() => {
    page = new AppPage();
    navBar = new NavbarPage();
    prestamo = new PrestamoPage();
  });

  it('Debería crear un prestamo', () => {
    const ISBN = 'A354874R';
    const NOMBRE_PRESTADOR = 'Felipe Alzate';

    page.navigateTo();
    navBar.clickBotonPrestamos();

    prestamo.setIsbn(ISBN);
    prestamo.setNombre(NOMBRE_PRESTADOR);
    prestamo.clickBotonPrestar();



  })
});
