import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-translation',
  templateUrl: './translation.component.html',
  styleUrls: ['./translation.component.css']
})
export class TranslationComponent implements OnInit {
  selectedLanguage = 'es';
  localTranslate = null;

  constructor(public translate: TranslateService) {
    translate.addLangs(['en', 'es']);

    translate.use(this.selectedLanguage);
  }

  ngOnInit() {

  }

}
