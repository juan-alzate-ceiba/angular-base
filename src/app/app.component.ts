import { Component } from '@angular/core';
import { MenuItem } from '@core/modelo/menu-item';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'app-base';
  public navbarItems: MenuItem[] = [
    { url: '/home', nombre: 'Home' },
    { url: '/prestamos', nombre: 'Prestamos' },
    { url: '/libros', nombre: 'Libros' }
    // ,{ url: '/internacionalizacion', nombre: 'Internacionalizacion' }
  ];

   constructor(translate: TranslateService) {
     translate.stream('prestamos')
     .subscribe((res: string) => {
      // console.log(
      //   "%cStop!",
      //   "color:red;font-family:system-ui;font-size:4rem;-webkit-text-stroke: 1px black;font-weight:bold"
      // );
      //  console.log(res)
        this.navbarItems[1].nombre = res;    });
    }
}
