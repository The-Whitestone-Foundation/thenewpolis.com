---
title: Contact Us
layout: page.njk
description: Contact The New Polis
contact: 
  title: Get in Touch
  description: Whether you have questions about submission guidelines, editorial feedback, or general inquiries, please feel free to reach out.
address: 
  title: Office Address
  text: 
    - info: The New Polis Journal
    - info: Department of Religious Studies
    - info: Denver, Colorado, USA
github: adamdjbrett
email: hi@domain.com
permalink: /contact/
---
<div class="row g-5">
    <div class="col-md-6">
        <h3 class="serif fw-bold h4 mb-4">{{contact.title}}</h3>
        <p>{{contact.description}}</p>
        
        <ul class="list-unstyled mt-4">
            <li class="mb-3 d-flex align-items-center">
                <a href="mailto:{{ email or metadata.email }}" class="text-dark text-decoration-none border-bottom border-dark">
                    {{ email or metadata.email }}
                </a>
            </li>
            <li class="mb-3 d-flex align-items-center">
                <a href="https://github.com/{{ github or metadata.github }}" class="text-dark text-decoration-none" target="_blank">
                    github.com/{{ github or metadata.github }}
                </a>
            </li>
        </ul>
    </div>
    
    <div class="col-md-6">
        <div class="bg-light p-4 rounded border">
            <h4 class="h6 text-uppercase fw-bold mb-3" style="letter-spacing: 1px;">{{address.title}}</h4>
            <address class="small text-secondary mb-0">
                {% for s in address.text %}{{s.info}}<br>{% endfor %}
            </address>
        </div>
    </div>
</div>