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
  ];

   constructor(translate: TranslateService) {
     translate.stream('prestamos')
     .subscribe((res: string) => {

        this.navbarItems[1].nombre = res;    });
    }
}
