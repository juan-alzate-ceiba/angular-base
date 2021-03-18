import { LibroPage } from '../page/libros/libro.po';

describe('work-space project libro', () => {
  let libroPage: LibroPage;

  beforeEach(() => {
    libroPage = new LibroPage();
    libroPage.navigateTo();
  });

  it('Muestra mensaje error isbn obligatorio', () => {

    libroPage.setIsbn('');
    libroPage.setTitulo('Desterrados');
    libroPage.setAnio(2020);
    libroPage.clickBotonCrear().then(() => {
      const isbnMensaje = libroPage.getMensajeErrorIsbnRequerido();
      expect(isbnMensaje).toEqual('ISBN es obligatorio');
    });

  });

  // it('Muestra mensaje error nombre obligatorio', () => {
  //   libroPage.navigateTo();

  //   libroPage.setIsbn('');
  //   libroPage.setTitulo('');
  //   libroPage.clickBotonCrear().then(() => {
  //     const tituloMensaje = libroPage.getMensajeErrorTituloRequerido();
  //     expect(tituloMensaje).toEqual('Título es obligatorio');
  //   });

  // });

  // afterEach(async () => {
  //   // Assert that there are no errors emitted from the browser
  //   const logs = await browser.manage().logs().get(logging.Type.BROWSER);
  //   expect(logs).not.toContain(jasmine.objectContaining({
  //     level: logging.Level.SEVERE,
  //   } as logging.Entry));
  // });

  // afterAll(async (done) => {
  //   await browser.executeScript('window.localStorage.clear();');
  //   done();
  // })

});
