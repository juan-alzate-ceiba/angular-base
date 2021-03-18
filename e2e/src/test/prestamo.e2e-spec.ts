// import { browser } from 'protractor';
import { browser } from 'protractor';
import { PrestamoPage } from './../page/prestamo/prestamo.po';

const ISBN = 'A354874R';
const NOMBRE_PRESTADOR = 'Felipe Alzate';

describe('workspace-project Prestamo', () => {
  let prestamo: PrestamoPage;

  beforeEach(() => {
    prestamo = new PrestamoPage();
  });

  afterAll(async (done) => {
    await browser.executeScript('window.localStorage.clear();');
    done();
  });

  it('Muestra mensaje error ISBN obligatorio', () => {
    prestamo.navigateTo();

    prestamo.setIsbn('');
    prestamo.setNombre(NOMBRE_PRESTADOR);
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorISBNRequerido();
      expect(mensaje).toEqual('ISBN es obligatorio');
    });
  });

  it('Muestra mensaje error Nombre obligatorio', () => {
    prestamo.navigateTo();

    prestamo.setIsbn(ISBN);
    prestamo.setNombre('');
    prestamo.clickBotonPrestar().then(() => {
      const mensaje = prestamo.getMensajeErrorNombreRequirido();
      expect(mensaje).toEqual('Nombre es obligatorio');
    });
  });
});
